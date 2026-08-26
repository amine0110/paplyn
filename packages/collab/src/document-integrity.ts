import type { Doc, Text } from "./yjs.js";
import { isYTextLike, replaceYTextContent } from "./y-text.js";

/** Must match PERSIST_ACK_ORIGIN in persistence.ts — local to avoid circular imports. */
const PERSIST_ACK_ORIGIN = "persist-ack";

const DOCUMENTCLASS_RE = /^\s*\\documentclass\b/;
const BEGIN_DOCUMENT_MARKER_RE = /\\begin\{document/;
const BIB_ENTRY_KEY_RE = /@\w+\s*\{([^,\s}]+)/g;

/** Minimum stored HTTP length before a large ratio jump is treated as concatenation. */
export const CONCAT_JUMP_MIN_HTTP_LENGTH = 100;

/** Room content must exceed HTTP length by this factor to qualify as a far jump. */
export const CONCAT_FAR_JUMP_RATIO = 8;

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
  let count = 0;
  for (const line of content.split("\n")) {
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

/**
 * Collapse concatenated LaTeX / doubled .bib to a single copy for seeding.
 * Returns null when content cannot be safely collapsed.
 */
export function collapseConcatenatedSeedContent(path: string, content: string): string | null {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  const ext = dot === -1 ? "" : base.slice(dot + 1).toLowerCase();

  if (ext === "tex" || ext === "") {
    if (!hasMultipleDocumentCopies(content)) return content;
    const firstCopy = extractFirstLaTeXCopy(content);
    if (firstCopy.length > 0 && countDocumentClassLinesInFirstCopy(firstCopy) === 1) {
      return firstCopy;
    }
    return null;
  }

  if (ext === "bib" && countDuplicateBibKeys(content) > 0) {
    const seen = new Set<string>();
    const blocks: string[] = [];
    let current = "";
    for (const line of content.split("\n")) {
      current += (current ? "\n" : "") + line;
      const match = line.match(BIB_ENTRY_KEY_RE);
      if (match && line.trim().endsWith("}")) {
        const key = match[1];
        if (!seen.has(key)) {
          seen.add(key);
          blocks.push(current);
        }
        current = "";
      }
    }
    if (current.trim()) blocks.push(current);
    if (blocks.length > 0) return blocks.join("\n");
    return null;
  }

  return content;
}

/**
 * Detect Y.Text / HTTP payloads that look like stacked full-document concatenation
 * (stale client replay, multi-tab insert-at-0 races).
 */
export function looksLikeConcatenatedFileContent(
  proposed: string,
  existingHttp: string | undefined
): boolean {
  const documentClassCount = countDocumentClassLines(proposed);
  if (documentClassCount > 1) return true;

  if (!existingHttp || existingHttp.length === 0) return false;

  const existingLen = existingHttp.length;
  const proposedLen = proposed.length;

  if (proposed === existingHttp + existingHttp) return true;

  if (
    existingLen >= CONCAT_JUMP_MIN_HTTP_LENGTH &&
    proposedLen >= existingLen * CONCAT_FAR_JUMP_RATIO
  ) {
    return true;
  }

  if (
    countDuplicateBibKeys(proposed) > 0 &&
    countDuplicateBibKeys(existingHttp) === 0
  ) {
    const existingKeys = countBibEntryKeys(existingHttp);
    const proposedKeys = countBibEntryKeys(proposed);
    if (existingKeys > 0 && proposedKeys >= existingKeys * 2) return true;
  }

  return false;
}

export class PersistConcatenationError extends Error {
  constructor(
    readonly path: string,
    readonly proposedLength: number,
    readonly existingHttpLength: number,
    readonly documentClassCount: number
  ) {
    super(
      `[collab] refuse concatenated HTTP upsert for ${path}: proposed length=${proposedLength}, existing project_file length=${existingHttpLength}, \\documentclass count=${documentClassCount}`
    );
    this.name = "PersistConcatenationError";
  }
}

/** Block HTTP upserts that would replace a clean/smaller project_file with concatenated text. */
export function assertNoConcatenatedDocumentUpserts(
  files: Array<{ path: string; content: string }>,
  existingByPath: Map<string, string>
): void {
  for (const file of files) {
    const existing = existingByPath.get(file.path) ?? "";
    if (!looksLikeConcatenatedFileContent(file.content, existing)) continue;

    throw new PersistConcatenationError(
      file.path,
      file.content.length,
      existing.length,
      countDocumentClassLines(file.content)
    );
  }
}

/**
 * Restore authoritative HTTP (or first LaTeX copy) when room Y.Text looks concatenated.
 * Replace only — never append a second copy.
 */
export function repairConcatenatedRoomText(
  doc: Doc,
  authoritativeByPath: Map<string, string>,
  origin?: unknown
): boolean {
  if (origin === PERSIST_ACK_ORIGIN) return false;

  let repaired = false;
  for (const [path, httpContent] of authoritativeByPath) {
    const shared = doc.get(path);
    if (!isYTextLike(shared)) continue;

    const roomContent = shared.toString();
    if (roomContent === httpContent) continue;

    if (looksLikeConcatenatedFileContent(roomContent, httpContent)) {
      replaceYTextContent(shared as Text, httpContent);
      repaired = true;
      continue;
    }

    if (hasMultipleDocumentCopies(roomContent)) {
      const firstCopy = extractFirstLaTeXCopy(roomContent);
      if (firstCopy.length > 0 && countDocumentClassLinesInFirstCopy(firstCopy) === 1) {
        replaceYTextContent(shared as Text, firstCopy);
        repaired = true;
      }
    }
  }
  return repaired;
}
