import type { EditorView } from "@codemirror/view";
import type { AiClientAction } from "@/lib/ai-client-actions";
import { applyActionToFileContent } from "@/lib/ai-client-actions";

export interface ApplyAiActionsContext {
  activeFile: string | null;
  editorView: EditorView | null;
  fileContents: Record<string, string>;
  hasSelection: boolean;
  saveFile: (path: string, content: string) => Promise<void>;
  onSwitchFile?: (path: string) => void;
}

export interface ApplyAiActionsResult {
  applied: AiClientAction[];
  skipped: { action: AiClientAction; reason: string }[];
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

async function applyFileEdit(
  ctx: ApplyAiActionsContext,
  file: string,
  search: string,
  replace: string
): Promise<boolean> {
  const content = ctx.fileContents[file];
  if (content == null) return false;

  const updated = applyActionToFileContent(content, {
    type: "apply_edit",
    file,
    search,
    replace,
    label: "",
  });
  if (updated == null) return false;

  if (ctx.activeFile === file && ctx.editorView) {
    const index = content.indexOf(search);
    if (index === -1) return false;
    applyToActiveEditor(ctx.editorView, index, index + search.length, replace);
    return true;
  }

  await ctx.saveFile(file, updated);
  if (ctx.onSwitchFile) ctx.onSwitchFile(file);
  return true;
}

export async function applyAiClientActions(
  actions: AiClientAction[],
  ctx: ApplyAiActionsContext
): Promise<ApplyAiActionsResult> {
  const applied: AiClientAction[] = [];
  const skipped: { action: AiClientAction; reason: string }[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "insert_at_cursor": {
          const view = ctx.editorView;
          if (!view) {
            skipped.push({ action, reason: "No active editor" });
            break;
          }
          const { from, to } = view.state.selection.main;
          applyToActiveEditor(view, from, to, action.text);
          applied.push(action);
          break;
        }
        case "replace_selection": {
          const view = ctx.editorView;
          if (!view) {
            skipped.push({ action, reason: "No active editor" });
            break;
          }
          const { from, to } = view.state.selection.main;
          if (from === to && !ctx.hasSelection) {
            applyToActiveEditor(view, from, to, action.text);
          } else {
            applyToActiveEditor(view, from, to, action.text);
          }
          applied.push(action);
          break;
        }
        case "apply_edit": {
          if (action.search) {
            const ok = await applyFileEdit(ctx, action.file, action.search, action.replace);
            if (ok) applied.push(action);
            else skipped.push({ action, reason: "Could not apply edit" });
          } else if (action.startLine != null && action.endLine != null) {
            const content = ctx.fileContents[action.file];
            if (content == null) {
              skipped.push({ action, reason: "File not found" });
              break;
            }
            const updated = applyActionToFileContent(content, action);
            if (updated == null) {
              skipped.push({ action, reason: "Line range edit failed" });
              break;
            }
            if (ctx.activeFile === action.file && ctx.editorView) {
              const lines = content.split("\n");
              const startOffset =
                lines.slice(0, action.startLine - 1).join("\n").length +
                (action.startLine > 1 ? 1 : 0);
              const endOffset =
                lines.slice(0, action.endLine).join("\n").length;
              applyToActiveEditor(ctx.editorView, startOffset, endOffset, action.replace);
            } else {
              await ctx.saveFile(action.file, updated);
            }
            applied.push(action);
          } else {
            skipped.push({ action, reason: "Missing search or line range" });
          }
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
