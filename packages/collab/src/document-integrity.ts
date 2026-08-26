const DOCUMENTCLASS_RE = /^\s*\\documentclass\b/;
const BEGIN_DOCUMENT_MARKER_RE = /\\begin\{document/;
const BIB_ENTRY_KEY_RE = /@\w+\s*\{([^,\s}]+)/g;

function isCommentLine(trimmed: string): boolean {
  return !trimmed || trimmed.startsWith("%");
}

function isBeginDocumentLine(text: string): boolean {
  const trimmed = text.trim();
  if (isCommentLine(trimmed)) return false;
  return BEGIN_DOCUMENT_MARKER_RE.test(trimmed);
}

/** Line number of the last line in the first compiled document copy (1-based). */
export function getFirstLaTeXCopyEndLine(content: string): number {
  const lines = content.split("\n");
  let seenBeginDocument = false;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (isCommentLine(trimmed)) continue;

    if (trimmed.includes("\\end{document}")) {
      return i + 1;
    }

    if (isBeginDocumentLine(trimmed)) {
      seenBeginDocument = true;
      continue;
    }

    if (DOCUMENTCLASS_RE.test(trimmed) && seenBeginDocument) {
      return i;
    }
  }

  return lines.length;
}

/** Count non-comment \\documentclass lines in the first document copy. */
export function countDocumentClassLinesInFirstCopy(content: string): number {
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const lines = content.split("\n");
  const limit = Math.min(firstCopyEnd, lines.length);
  let count = 0;

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (isCommentLine(trimmed)) continue;
    if (DOCUMENTCLASS_RE.test(trimmed)) count += 1;
  }

  return count;
}

/** Count all non-comment \\documentclass lines in the full buffer. */
export function countDocumentClassLines(content: string): number {
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (isCommentLine(trimmed)) continue;
    if (DOCUMENTCLASS_RE.test(trimmed)) count += 1;
  }

  return count;
}

export function hasMultipleDocumentCopies(content: string): boolean {
  return countDocumentClassLines(content) > 1;
}

/** Trim to the first LaTeX document copy (through first \\end{document} or before a stacked preamble). */
export function extractFirstLaTeXCopy(content: string): string {
  const endLine = getFirstLaTeXCopyEndLine(content);
  return content.split("\n").slice(0, endLine).join("\n");
}

export function countBibEntryKeys(content: string): number {
  const matches = content.match(BIB_ENTRY_KEY_RE);
  return matches?.length ?? 0;
}

export function countDuplicateBibKeys(content: string): number {
  const keys: string[] = [];
  for (const match of content.matchAll(BIB_ENTRY_KEY_RE)) {
    keys.push(match[1]);
  }
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates;
}

/** True when new content is dramatically larger than stored HTTP (concatenation symptom). */
export function isSuspiciousSizeJump(existingLength: number, newLength: number): boolean {
  if (existingLength <= 0 || newLength <= existingLength) return false;
  if (newLength >= existingLength * 2) return true;
  // Small clean templates restored then replayed as one extra full copy.
  return newLength >= existingLength + Math.max(500, existingLength);
}

export type PersistConcatenationCheck =
  | { ok: true }
  | {
      ok: false;
      path: string;
      existingLength: number;
      newLength: number;
      documentClassCount: number;
      existingDocumentClassCount: number;
      reason: string;
    };

/**
 * Block HTTP upserts that would replace a clean/smaller project_file with concatenated
 * LaTeX (multiple \\documentclass) or a dramatic size jump — the llm-similarity incident pattern.
 */
export function checkPersistConcatenationGuard(
  path: string,
  existingContent: string | undefined,
  newContent: string
): PersistConcatenationCheck {
  const existing = existingContent ?? "";
  const existingLength = existing.length;
  const newLength = newContent.length;
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  const ext = dot === -1 ? "" : base.slice(dot + 1).toLowerCase();

  if (ext === "tex" || ext === "") {
    const newDocClassCount = countDocumentClassLines(newContent);
    const existingDocClassCount = countDocumentClassLines(existing);

    if (newDocClassCount > 1 && existingDocClassCount <= 1 && existingLength > 0) {
      return {
        ok: false,
        path,
        existingLength,
        newLength,
        documentClassCount: newDocClassCount,
        existingDocumentClassCount: existingDocClassCount,
        reason:
          `refuse concatenated LaTeX upsert for ${path}: ` +
          `${newDocClassCount} \\documentclass in proposed content vs ${existingDocClassCount} in HTTP ` +
          `(length ${existingLength} -> ${newLength})`,
      };
    }

    if (
      existingLength > 0 &&
      isSuspiciousSizeJump(existingLength, newLength) &&
      newDocClassCount > existingDocClassCount
    ) {
      return {
        ok: false,
        path,
        existingLength,
        newLength,
        documentClassCount: newDocClassCount,
        existingDocumentClassCount: existingDocClassCount,
        reason:
          `refuse suspicious LaTeX size jump for ${path}: ` +
          `length ${existingLength} -> ${newLength}, ` +
          `\\documentclass ${existingDocClassCount} -> ${newDocClassCount}`,
      };
    }
  }

  if (ext === "bib" && existingLength > 0) {
    const existingKeys = countBibEntryKeys(existing);
    const newKeys = countBibEntryKeys(newContent);
    const newDuplicates = countDuplicateBibKeys(newContent);

    if (
      existingKeys > 0 &&
      newKeys >= existingKeys * 2 &&
      newDuplicates > 0 &&
      countDuplicateBibKeys(existing) === 0
    ) {
      return {
        ok: false,
        path,
        existingLength,
        newLength,
        documentClassCount: 0,
        existingDocumentClassCount: 0,
        reason:
          `refuse doubled .bib upsert for ${path}: ` +
          `${existingKeys} entries in HTTP -> ${newKeys} with duplicate keys (length ${existingLength} -> ${newLength})`,
      };
    }
  }

  return { ok: true };
}
