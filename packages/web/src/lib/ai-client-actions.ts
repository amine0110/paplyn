/** Client-side editor actions returned by the AI assistant API. */

export const MAX_CLIENT_EDIT_CHARS = 8_000;

export type AiClientActionType =
  | "insert_at_cursor"
  | "replace_selection"
  | "apply_edit"
  | "fix_compile_errors";

export interface AiClientActionBase {
  type: AiClientActionType;
  /** Short label for UI chips, e.g. "Applied edit to main.tex". */
  label: string;
}

export interface InsertAtCursorAction extends AiClientActionBase {
  type: "insert_at_cursor";
  text: string;
}

export interface ReplaceSelectionAction extends AiClientActionBase {
  type: "replace_selection";
  text: string;
}

export interface ApplyEditAction extends AiClientActionBase {
  type: "apply_edit";
  file: string;
  /** Exact substring to replace in the file. Must appear once when provided. */
  search?: string;
  replace: string;
  /** 1-based inclusive line range alternative to search/replace. */
  startLine?: number;
  endLine?: number;
}

export interface FixCompileErrorsEdit {
  file: string;
  search: string;
  replace: string;
}

export interface FixCompileErrorsAction extends AiClientActionBase {
  type: "fix_compile_errors";
  edits: FixCompileErrorsEdit[];
}

export type AiClientAction =
  | InsertAtCursorAction
  | ReplaceSelectionAction
  | ApplyEditAction
  | FixCompileErrorsAction;

export interface ClientActionToolPayload {
  kind: "client-action";
  action: AiClientAction;
}

export function isClientActionPayload(result: unknown): result is ClientActionToolPayload {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as ClientActionToolPayload).kind === "client-action" &&
    typeof (result as ClientActionToolPayload).action === "object"
  );
}

export function capEditText(text: string, max = MAX_CLIENT_EDIT_CHARS): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return null;
  return text;
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) break;
    count += 1;
    index = found + needle.length;
  }
  return count;
}

export interface ValidateActionContext {
  texFiles: Map<string, string>;
  activeFile?: string;
  hasSelection: boolean;
}

export interface ValidatedAction {
  action: AiClientAction;
  warning?: string;
}

function validateFilePath(
  file: string,
  texFiles: Map<string, string>
): string | null {
  const normalized = file.replace(/^\.\//, "").trim();
  if (!normalized.endsWith(".tex")) return null;
  if (!texFiles.has(normalized)) return null;
  return normalized;
}

function applySearchReplace(
  content: string,
  search: string,
  replace: string
): { ok: true; content: string } | { ok: false; reason: string } {
  const occurrences = countOccurrences(content, search);
  if (occurrences === 0) {
    return { ok: false, reason: "search text not found in file" };
  }
  if (occurrences > 1) {
    return { ok: false, reason: "search text is ambiguous (multiple matches)" };
  }
  return { ok: true, content: content.replace(search, replace) };
}

function applyLineRangeEdit(
  content: string,
  startLine: number,
  endLine: number,
  newText: string
): { ok: true; content: string } | { ok: false; reason: string } {
  const lines = content.split("\n");
  if (startLine < 1 || endLine < startLine || endLine > lines.length) {
    return { ok: false, reason: "line range out of bounds" };
  }
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const next = [...before, newText, ...after].join("\n");
  return { ok: true, content: next };
}

/** Server-side validation before returning an action to the client. */
export function validateClientAction(
  raw: Omit<AiClientAction, "label"> & { label?: string },
  ctx: ValidateActionContext
): ValidatedAction | null {
  const label = raw.label?.trim();

  switch (raw.type) {
    case "insert_at_cursor": {
      const text = capEditText(raw.text);
      if (!text) return null;
      return {
        action: {
          type: "insert_at_cursor",
          text,
          label: label || "Inserted text at cursor",
        },
      };
    }
    case "replace_selection": {
      const text = capEditText(raw.text);
      if (!text) return null;
      if (!ctx.hasSelection) {
        return {
          action: {
            type: "replace_selection",
            text,
            label: label || "Replaced selection",
          },
          warning: "No selection in editor; client will insert at cursor instead",
        };
      }
      return {
        action: {
          type: "replace_selection",
          text,
          label: label || "Replaced selection",
        },
      };
    }
    case "apply_edit": {
      const file = validateFilePath(raw.file, ctx.texFiles);
      if (!file) return null;
      const replace = capEditText(raw.replace);
      if (!replace) return null;

      const content = ctx.texFiles.get(file) ?? "";
      let preview: { ok: true; content: string } | { ok: false; reason: string };

      if (raw.search) {
        const search = raw.search;
        if (search.length > MAX_CLIENT_EDIT_CHARS) return null;
        preview = applySearchReplace(content, search, replace);
      } else if (raw.startLine != null && raw.endLine != null) {
        preview = applyLineRangeEdit(content, raw.startLine, raw.endLine, replace);
      } else {
        return null;
      }

      if (!preview.ok) return null;

      return {
        action: {
          type: "apply_edit",
          file,
          search: raw.search,
          replace,
          startLine: raw.startLine,
          endLine: raw.endLine,
          label: label || `Applied edit to ${file}`,
        },
      };
    }
    case "fix_compile_errors": {
      const edits: FixCompileErrorsEdit[] = [];
      for (const edit of raw.edits ?? []) {
        const file = validateFilePath(edit.file, ctx.texFiles);
        if (!file) continue;
        const replace = capEditText(edit.replace);
        if (!replace || !edit.search || edit.search.length > MAX_CLIENT_EDIT_CHARS) continue;
        const content = ctx.texFiles.get(file) ?? "";
        const preview = applySearchReplace(content, edit.search, replace);
        if (!preview.ok) continue;
        edits.push({ file, search: edit.search, replace });
      }
      if (edits.length === 0) return null;
      return {
        action: {
          type: "fix_compile_errors",
          edits,
          label: label || `Fixed ${edits.length} compile error(s)`,
        },
      };
    }
    default:
      return null;
  }
}

/** Apply a validated action to file content (client-side preview / non-active files). */
export function applyActionToFileContent(
  content: string,
  action: ApplyEditAction | FixCompileErrorsEdit
): string | null {
  if ("edits" in action) return null;
  if (action.search) {
    const result = applySearchReplace(content, action.search, action.replace);
    return result.ok ? result.content : null;
  }
  if (action.startLine != null && action.endLine != null) {
    const result = applyLineRangeEdit(content, action.startLine, action.endLine, action.replace);
    return result.ok ? result.content : null;
  }
  return null;
}

export function describeAppliedAction(action: AiClientAction): string {
  return action.label;
}
