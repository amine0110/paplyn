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
  /** Exact substring to replace in the file. Must appear once. */
  search: string;
  replace: string;
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

/** Unlabeled action payload from the model before server validation. */
export type RawAiClientAction =
  | Omit<InsertAtCursorAction, "label">
  | Omit<ReplaceSelectionAction, "label">
  | Omit<ApplyEditAction, "label">
  | Omit<FixCompileErrorsAction, "label">;

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

export interface RejectedAction {
  rejected: true;
  reason: string;
}

export type ValidateClientActionResult = ValidatedAction | RejectedAction;

/** Strip one leading `N: ` prefix per line (legacy get_file numbered output). */
export function stripLineNumberPrefixes(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+:\s?/, ""))
    .join("\n");
}

function resolveUniqueSearch(
  content: string,
  search: string
): { search: string } | { ok: false; reason: string } {
  const trimmed = search.trim();
  if (!trimmed) {
    return { ok: false, reason: "search text is empty" };
  }

  let occurrences = countOccurrences(content, trimmed);
  if (occurrences === 1) {
    return { search: trimmed };
  }

  if (occurrences === 0) {
    const stripped = stripLineNumberPrefixes(trimmed);
    if (stripped !== trimmed) {
      occurrences = countOccurrences(content, stripped);
      if (occurrences === 1) {
        return { search: stripped };
      }
    }
    return {
      ok: false,
      reason:
        "search text not found in file. Retry with an exact unnumbered substring from get_file that appears once.",
    };
  }

  return {
    ok: false,
    reason:
      "search text is ambiguous (multiple matches). Retry with a longer exact substring that appears once.",
  };
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
): { ok: true; content: string; search: string } | { ok: false; reason: string } {
  const resolved = resolveUniqueSearch(content, search);
  if ("ok" in resolved) {
    return { ok: false, reason: resolved.reason };
  }
  const { search: resolvedSearch } = resolved;
  return {
    ok: true,
    content: content.replace(resolvedSearch, replace),
    search: resolvedSearch,
  };
}

/** Server-side validation before returning an action to the client. */
export function validateClientAction(
  raw: RawAiClientAction,
  ctx: ValidateActionContext
): ValidateClientActionResult {
  switch (raw.type) {
    case "insert_at_cursor": {
      const text = capEditText(raw.text);
      if (!text) {
        return { rejected: true, reason: "Insert text is empty or exceeds size limits." };
      }
      return {
        action: {
          type: "insert_at_cursor",
          text,
          label: "Inserted text at cursor",
        },
      };
    }
    case "replace_selection": {
      const text = capEditText(raw.text);
      if (!text) {
        return { rejected: true, reason: "Replacement text is empty or exceeds size limits." };
      }
      if (!ctx.hasSelection) {
        return {
          action: {
            type: "replace_selection",
            text,
            label: "Replaced selection",
          },
          warning: "No selection in editor; client will insert at cursor instead",
        };
      }
      return {
        action: {
          type: "replace_selection",
          text,
          label: "Replaced selection",
        },
      };
    }
    case "apply_edit": {
      const file = validateFilePath(raw.file, ctx.texFiles);
      if (!file) {
        return {
          rejected: true,
          reason: "File path is invalid or not in this project. Use list_files to discover paths.",
        };
      }
      const replace = capEditText(raw.replace);
      if (!replace) {
        return { rejected: true, reason: "Replacement text is empty or exceeds size limits." };
      }

      const searchTrimmed = raw.search?.trim() ?? "";
      if (!searchTrimmed || searchTrimmed.length > MAX_CLIENT_EDIT_CHARS) {
        return {
          rejected: true,
          reason:
            "Search text is empty or exceeds size limits. Retry with an exact unnumbered substring from get_file that appears once.",
        };
      }

      const content = ctx.texFiles.get(file) ?? "";
      const preview = applySearchReplace(content, searchTrimmed, replace);
      if (!preview.ok) {
        return { rejected: true, reason: preview.reason };
      }

      return {
        action: {
          type: "apply_edit",
          file,
          search: preview.search,
          replace,
          label: `Applied edit to ${file}`,
        },
      };
    }
    case "fix_compile_errors": {
      const edits: FixCompileErrorsEdit[] = [];
      const rejections: string[] = [];
      for (const edit of raw.edits ?? []) {
        const file = validateFilePath(edit.file, ctx.texFiles);
        if (!file) {
          rejections.push(`invalid file "${edit.file}"`);
          continue;
        }
        const replace = capEditText(edit.replace);
        if (!replace || !edit.search || edit.search.length > MAX_CLIENT_EDIT_CHARS) {
          rejections.push(`invalid edit for ${file}`);
          continue;
        }
        const content = ctx.texFiles.get(file) ?? "";
        const preview = applySearchReplace(content, edit.search, replace);
        if (!preview.ok) {
          rejections.push(`${file}: ${preview.reason}`);
          continue;
        }
        edits.push({ file, search: preview.search, replace });
      }
      if (edits.length === 0) {
        return {
          rejected: true,
          reason:
            rejections.length > 0
              ? `No valid edits: ${rejections.join("; ")}`
              : "No valid compile-error edits. Use get_file and retry with exact unnumbered substrings that appear once.",
        };
      }
      return {
        action: {
          type: "fix_compile_errors",
          edits,
          label: `Fixed ${edits.length} compile error(s)`,
        },
      };
    }
    default:
      return { rejected: true, reason: "Unknown client action type." };
  }
}

/** Apply a validated action to file content (client-side preview / non-active files). */
export function applyActionToFileContent(
  content: string,
  action: ApplyEditAction
): string | null {
  const result = applySearchReplace(content, action.search, action.replace);
  return result.ok ? result.content : null;
}

export function describeAppliedAction(action: AiClientAction): string {
  return action.label;
}
