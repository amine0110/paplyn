import type { EditorView } from "@codemirror/view";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  applyActionToFileContent,
  applyReplaceLinesToFileContent,
  lineRangeToOffsets,
} from "@/lib/ai-client-actions";
import { validateCompileFixEdit } from "@/lib/ai-compile-fix-validation";
import { validateNoSiblingCommandStacking } from "@/lib/ai-edit-guards";

export interface ApplyAiActionsContext {
  activeFile: string | null;
  editorView: EditorView | null;
  fileContents: Record<string, string>;
  hasSelection: boolean;
  /** When set, editor actions apply at this range instead of the live selection. */
  selectionRange?: { from: number; to: number };
  saveFile: (path: string, content: string) => Promise<void>;
  onSwitchFile?: (path: string) => void;
  /** When true, reject edits that break compile-fix preamble guards. */
  compileFix?: boolean;
}

function resolveEditorRange(
  view: EditorView,
  ctx: ApplyAiActionsContext
): { from: number; to: number } {
  if (ctx.selectionRange) {
    return ctx.selectionRange;
  }
  const { from, to } = view.state.selection.main;
  return { from, to };
}

export interface ApplyAiActionsResult {
  applied: AiClientAction[];
  skipped: { action: AiClientAction; reason: string }[];
}

/** Ensure cursor inserts do not glue onto the following token when missing a newline. */
export function normalizeInsertAtCursorText(
  text: string,
  document: string,
  cursorPos: number
): string {
  if (!text) return text;

  const charAfter = cursorPos < document.length ? document[cursorPos] : undefined;
  const needsTrailingNewline =
    !text.endsWith("\n") && charAfter !== undefined && !/\s/.test(charAfter);

  if (!needsTrailingNewline) return text;

  const lineStart = document.lastIndexOf("\n", cursorPos - 1) + 1;
  const atLineStart = cursorPos === lineStart;
  const isFullLineComment = /^\s*%/.test(text);
  const needsLeadingNewline = !atLineStart && !text.startsWith("\n") && isFullLineComment;

  let result = text;
  if (needsLeadingNewline) result = `\n${result}`;
  return `${result}\n`;
}

function dispatchEditorChange(view: EditorView, from: number, to: number, insert: string) {
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
}

function applyToActiveEditor(
  view: EditorView,
  from: number,
  to: number,
  text: string
): void {
  dispatchEditorChange(view, from, to, text);
}

function rejectCompileFixPreview(
  ctx: ApplyAiActionsContext,
  content: string,
  replace: string,
  previewContent: string,
  startLine?: number,
  endLine?: number
): string | null {
  if (!ctx.compileFix) return null;
  const check = validateCompileFixEdit({
    content,
    replace,
    previewContent,
    startLine,
    endLine,
  });
  return check.ok ? null : check.reason;
}

function rejectSiblingStackingPreview(
  content: string,
  previewContent: string
): string | null {
  const check = validateNoSiblingCommandStacking(content, previewContent);
  return check.ok ? null : check.reason;
}

function resolveFileContent(ctx: ApplyAiActionsContext, file: string): string | null {
  if (ctx.activeFile === file && ctx.editorView) {
    return ctx.editorView.state.doc.toString();
  }
  const content = ctx.fileContents[file];
  return content ?? null;
}

async function applyFileEdit(
  ctx: ApplyAiActionsContext,
  file: string,
  search: string,
  replace: string
): Promise<boolean> {
  const content = resolveFileContent(ctx, file);
  if (content == null) return false;

  const updated = applyActionToFileContent(content, {
    type: "apply_edit",
    file,
    search,
    replace,
    label: "",
  });
  if (updated == null) return false;

  const stackingReject = rejectSiblingStackingPreview(content, updated);
  if (stackingReject) return false;

  const compileFixReject = rejectCompileFixPreview(ctx, content, replace, updated);
  if (compileFixReject) return false;

  if (ctx.activeFile === file && ctx.editorView) {
    const index = content.indexOf(search);
    if (index === -1) return false;
    applyToActiveEditor(ctx.editorView, index, index + search.length, replace);
  } else {
    await ctx.saveFile(file, updated);
    if (ctx.onSwitchFile) ctx.onSwitchFile(file);
  }

  ctx.fileContents[file] = updated;
  return true;
}

async function applyLinesEdit(
  ctx: ApplyAiActionsContext,
  file: string,
  startLine: number,
  endLine: number,
  replace: string
): Promise<boolean> {
  const content = resolveFileContent(ctx, file);
  if (content == null) return false;

  const action = {
    type: "replace_lines" as const,
    file,
    startLine,
    endLine,
    replace,
    label: "",
  };
  const updated = applyReplaceLinesToFileContent(content, action);
  if (updated == null) return false;

  const stackingReject = rejectSiblingStackingPreview(content, updated);
  if (stackingReject) return false;

  const compileFixReject = rejectCompileFixPreview(
    ctx,
    content,
    replace,
    updated,
    startLine,
    endLine
  );
  if (compileFixReject) return false;

  if (ctx.activeFile === file && ctx.editorView) {
    const range = lineRangeToOffsets(content, startLine, endLine);
    if (!range) return false;
    applyToActiveEditor(ctx.editorView, range.from, range.to, replace);
  } else {
    await ctx.saveFile(file, updated);
    if (ctx.onSwitchFile) ctx.onSwitchFile(file);
  }

  ctx.fileContents[file] = updated;
  return true;
}

export async function applyAiClientActions(
  actions: AiClientAction[],
  ctx: ApplyAiActionsContext
): Promise<ApplyAiActionsResult> {
  const applied: AiClientAction[] = [];
  const skipped: { action: AiClientAction; reason: string }[] = [];

  const lineEdits = actions.filter((action) => action.type === "replace_lines");
  const otherActions = actions.filter((action) => action.type !== "replace_lines");
  const sortedLineEdits = [...lineEdits].sort((a, b) => {
    if (a.type !== "replace_lines" || b.type !== "replace_lines") return 0;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return b.startLine - a.startLine;
  });
  const orderedActions = [...otherActions, ...sortedLineEdits];

  for (const action of orderedActions) {
    try {
      switch (action.type) {
        case "insert_at_cursor": {
          const view = ctx.editorView;
          if (!view) {
            skipped.push({ action, reason: "No active editor" });
            break;
          }
          const { from, to } = resolveEditorRange(view, ctx);
          const doc = view.state.doc.toString();
          const hasSpan = from !== to || ctx.hasSelection;
          const text = hasSpan
            ? action.text
            : normalizeInsertAtCursorText(action.text, doc, from);
          applyToActiveEditor(view, from, to, text);
          applied.push(action);
          break;
        }
        case "replace_selection": {
          const view = ctx.editorView;
          if (!view) {
            skipped.push({ action, reason: "No active editor" });
            break;
          }
          const { from, to } = resolveEditorRange(view, ctx);
          applyToActiveEditor(view, from, to, action.text);
          applied.push(action);
          break;
        }
        case "apply_edit": {
          const ok = await applyFileEdit(ctx, action.file, action.search, action.replace);
          if (ok) applied.push(action);
          else skipped.push({ action, reason: "Could not apply edit" });
          break;
        }
        case "replace_lines": {
          const ok = await applyLinesEdit(
            ctx,
            action.file,
            action.startLine,
            action.endLine,
            action.replace
          );
          if (ok) applied.push(action);
          else skipped.push({ action, reason: "Could not replace lines" });
          break;
        }
        case "fix_compile_errors": {
          let anyApplied = false;
          for (const edit of action.edits) {
            const ok = await applyFileEdit(ctx, edit.file, edit.search, edit.replace);
            if (ok) anyApplied = true;
          }
          if (anyApplied) applied.push(action);
          else skipped.push({ action, reason: "No compile fixes applied" });
          break;
        }
        default:
          skipped.push({ action, reason: "Unknown action type" });
      }
    } catch {
      skipped.push({ action, reason: "Unexpected error" });
    }
  }

  return { applied, skipped };
}
