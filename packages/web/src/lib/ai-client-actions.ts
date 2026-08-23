/** Client-side editor actions returned by the AI assistant API. */

export const MAX_CLIENT_EDIT_CHARS = 8_000;

export type AiClientActionType =
  | "insert_at_cursor"
  | "replace_selection"
  | "apply_edit"
  | "replace_lines"
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

export interface ReplaceLinesAction extends AiClientActionBase {
  type: "replace_lines";
  file: string;
  /** 1-based inclusive start line. */
  startLine: number;
  /** 1-based inclusive end line. */
  endLine: number;
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
  | ReplaceLinesAction
  | FixCompileErrorsAction;

/** Unlabeled action payload from the model before server validation. */
export type RawAiClientAction =
  | Omit<InsertAtCursorAction, "label">
  | Omit<ReplaceSelectionAction, "label">
  | Omit<ApplyEditAction, "label">
  | Omit<ReplaceLinesAction, "label">
  | Omit<FixCompileErrorsAction, "label">;

export interface ClientActionToolPayload {
  kind: "client-action";
  action: AiClientAction;
}

export interface ClientActionRejectedPayload {
  kind: "client-action-rejected";
  reason: string;
  matchCount?: number;
  matchLineNumbers?: number[];
  searchPreview?: string;
  emptySearch?: boolean;
}

export function isClientActionPayload(result: unknown): result is ClientActionToolPayload {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as ClientActionToolPayload).kind === "client-action" &&
    typeof (result as ClientActionToolPayload).action === "object"
  );
}

export function isClientActionRejectedPayload(
  result: unknown
): result is ClientActionRejectedPayload {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as ClientActionRejectedPayload).kind === "client-action-rejected" &&
    typeof (result as ClientActionRejectedPayload).reason === "string"
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

/** Return 1-based line numbers for the first few substring matches. */
export function findOccurrenceLineNumbers(
  content: string,
  needle: string,
  max = 10
): number[] {
  if (!needle) return [];
  const lineStarts: number[] = [];
  let pos = 0;
  for (const line of content.split("\n")) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }

  const results: number[] = [];
  let index = 0;
  while (results.length < max) {
    const found = content.indexOf(needle, index);
    if (found === -1) break;
    let lineNum = 1;
    for (let i = 0; i < lineStarts.length; i += 1) {
      if (lineStarts[i] <= found) lineNum = i + 1;
    }
    results.push(lineNum);
    index = found + needle.length;
  }
  return results;
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
  matchCount?: number;
  matchLineNumbers?: number[];
  searchPreview?: string;
  emptySearch?: boolean;
}

export type ValidateClientActionResult = ValidatedAction | RejectedAction;

/** Strip one leading `N: ` prefix per line (legacy get_file numbered output). */
export function stripLineNumberPrefixes(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+:\s?/, ""))
    .join("\n");
}

export function buildSearchPreview(search: string, maxLen = 80): string {
  const oneLine = search.replace(/\r\n/g, "\n").replace(/\n/g, "\\n");
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}...`;
}

function collectSearchCandidates(search: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  add(search);
  add(stripLineNumberPrefixes(search));
  const trimmed = search.trim();
  if (trimmed !== search) {
    add(trimmed);
    add(stripLineNumberPrefixes(trimmed));
  }

  return candidates;
}

function buildSearchRejectReason(
  matchCount: number,
  matchLineNumbers: number[],
  emptySearch: boolean,
  searchPreview: string
): string {
  if (emptySearch) {
    return "search text is empty. Use replace_lines when compile errors cite a line number.";
  }
  const preview = searchPreview ? ` (search: "${searchPreview}")` : "";
  if (matchCount === 0) {
    return `search text not found in file (0 matches)${preview}. Use replace_lines when compile errors cite a line number.`;
  }
  const lineHint =
    matchLineNumbers.length > 0 ? ` at lines ${matchLineNumbers.join(", ")}` : "";
  const more = matchCount > matchLineNumbers.length ? " (and more)" : "";
  return `search text is ambiguous (${matchCount} matches${lineHint}${more})${preview}. Use replace_lines for the cited line range instead of apply_edit.`;
}

type ResolveUniqueSearchResult =
  | { search: string }
  | {
      ok: false;
      reason: string;
      matchCount: number;
      matchLineNumbers: number[];
      searchPreview: string;
      emptySearch: boolean;
    };

function resolveUniqueSearch(content: string, search: string): ResolveUniqueSearchResult {
  if (!search.trim()) {
    return {
      ok: false,
      reason: buildSearchRejectReason(0, [], true, ""),
      matchCount: 0,
      matchLineNumbers: [],
      searchPreview: "",
      emptySearch: true,
    };
  }

  const candidates = collectSearchCandidates(search);

  for (const needle of candidates) {
    const count = countOccurrences(content, needle);
    if (count === 1) {
      return { search: needle };
    }
  }

  let bestNeedle = candidates[0];
  let bestCount = 0;

  const strippedFromRaw = stripLineNumberPrefixes(search);
  const strippedCandidates: string[] = [];
  if (strippedFromRaw !== search) strippedCandidates.push(strippedFromRaw);
  const trimmed = search.trim();
  const strippedFromTrimmed = stripLineNumberPrefixes(trimmed);
  if (trimmed !== search && strippedFromTrimmed !== trimmed) {
    strippedCandidates.push(strippedFromTrimmed);
  }

  for (const needle of strippedCandidates) {
    const count = countOccurrences(content, needle);
    if (count > 0) {
      bestNeedle = needle;
      bestCount = count;
      break;
    }
  }

  if (bestCount === 0) {
    for (const needle of candidates) {
      const count = countOccurrences(content, needle);
      if (count > bestCount) {
        bestCount = count;
        bestNeedle = needle;
      }
    }
  }

  const matchLineNumbers = findOccurrenceLineNumbers(content, bestNeedle);
  const searchPreview = buildSearchPreview(bestNeedle);

  return {
    ok: false,
    reason: buildSearchRejectReason(bestCount, matchLineNumbers, false, searchPreview),
    matchCount: bestCount,
    matchLineNumbers,
    searchPreview,
    emptySearch: false,
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
): { ok: true; content: string; search: string } | RejectedAction {
  const resolved = resolveUniqueSearch(content, search);
  if ("ok" in resolved) {
    return {
      rejected: true,
      reason: resolved.reason,
      matchCount: resolved.matchCount,
      matchLineNumbers: resolved.matchLineNumbers,
      searchPreview: resolved.searchPreview,
      emptySearch: resolved.emptySearch,
    };
  }
  const { search: resolvedSearch } = resolved;
  return {
    ok: true,
    content: content.replace(resolvedSearch, replace),
    search: resolvedSearch,
  };
}

export function formatReplaceLinesLabel(
  file: string,
  startLine: number,
  endLine: number
): string {
  const range =
    startLine === endLine ? `line ${startLine}` : `lines ${startLine}–${endLine}`;
  return `Replaced ${range} in ${file}`;
}

export function applyLinesReplace(
  content: string,
  startLine: number,
  endLine: number,
  replace: string
): { ok: true; content: string } | { ok: false; reason: string } {
  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine < 1 || endLine < 1) {
    return {
      ok: false,
      reason: "startLine and endLine must be positive integers (1-based).",
    };
  }
  if (endLine < startLine) {
    return { ok: false, reason: "endLine must be >= startLine." };
  }

  const lines = content.split("\n");
  const totalLines = lines.length;

  if (startLine > totalLines) {
    return {
      ok: false,
      reason: `startLine ${startLine} is past the end of the file (${totalLines} lines).`,
    };
  }

  const clampedEnd = Math.min(endLine, totalLines);
  const newContent = [
    ...lines.slice(0, startLine - 1),
    ...replace.split("\n"),
    ...lines.slice(clampedEnd),
  ].join("\n");

  return { ok: true, content: newContent };
}

/** Character offsets for a 1-based inclusive line range (for CodeMirror edits). */
export function lineRangeToOffsets(
  content: string,
  startLine: number,
  endLine: number
): { from: number; to: number } | null {
  const lines = content.split("\n");
  const total = lines.length;
  if (startLine < 1 || endLine < startLine || startLine > total) return null;

  const clampedEnd = Math.min(endLine, total);

  let from = 0;
  for (let i = 0; i < startLine - 1; i += 1) {
    from += lines[i].length + 1;
  }

  let to = from;
  for (let i = startLine - 1; i < clampedEnd; i += 1) {
    to += lines[i].length;
    if (i < clampedEnd - 1) to += 1;
  }

  return { from, to };
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
      if (!searchTrimmed) {
        return {
          rejected: true,
          reason: buildSearchRejectReason(0, [], true, ""),
          matchCount: 0,
          matchLineNumbers: [],
          searchPreview: "",
          emptySearch: true,
        };
      }
      if (searchTrimmed.length > MAX_CLIENT_EDIT_CHARS) {
        return {
          rejected: true,
          reason:
            "Search text exceeds size limits. Use replace_lines for a known line range instead.",
        };
      }

      const content = ctx.texFiles.get(file) ?? "";
      const preview = applySearchReplace(content, raw.search, replace);
      if ("rejected" in preview) {
        return preview;
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
    case "replace_lines": {
      const file = validateFilePath(raw.file, ctx.texFiles);
      if (!file) {
        return {
          rejected: true,
          reason: "File path is invalid or not in this project. Use list_files to discover paths.",
        };
      }

      if (raw.replace.length > MAX_CLIENT_EDIT_CHARS) {
        return { rejected: true, reason: "Replacement text exceeds size limits." };
      }

      const content = ctx.texFiles.get(file) ?? "";
      const preview = applyLinesReplace(content, raw.startLine, raw.endLine, raw.replace);
      if (!preview.ok) {
        return { rejected: true, reason: preview.reason };
      }

      return {
        action: {
          type: "replace_lines",
          file,
          startLine: raw.startLine,
          endLine: raw.endLine,
          replace: raw.replace,
          label: formatReplaceLinesLabel(file, raw.startLine, raw.endLine),
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
        if ("rejected" in preview) {
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
              : "No valid compile-error edits. Use get_file and retry with exact unnumbered substrings that appear once, or use replace_lines for known line ranges.",
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
  return "ok" in result && result.ok ? result.content : null;
}

/** Apply a validated replace_lines action to file content. */
export function applyReplaceLinesToFileContent(
  content: string,
  action: ReplaceLinesAction
): string | null {
  const result = applyLinesReplace(content, action.startLine, action.endLine, action.replace);
  return result.ok ? result.content : null;
}

export function describeAppliedAction(action: AiClientAction): string {
  return action.label;
}
