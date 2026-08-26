import type { Doc } from "./yjs.js";
import { isYTextLike, replaceYTextContent } from "./y-text.js";

/** Must match PERSIST_ACK_ORIGIN in persistence.ts — kept local to avoid circular imports. */
const PERSIST_ACK_ORIGIN = "persist-ack";

const DOCUMENTCLASS_RE = /^\s*\\documentclass\b/;

/** Minimum stored HTTP length before a large ratio jump is treated as concatenation. */
export const CONCAT_JUMP_MIN_HTTP_LENGTH = 100;

/** Room content must exceed HTTP length by this factor to qualify as a far jump. */
export const CONCAT_FAR_JUMP_RATIO = 8;

/** Count non-comment \\documentclass lines (anywhere in the file). */
export function countDocumentClassLines(content: string): number {
  let count = 0;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (DOCUMENTCLASS_RE.test(trimmed)) count += 1;
  }
  return count;
}

/**
 * Detect Y.Text / HTTP payloads that look like stacked full-document concatenation
 * (stale client replay, multi-tab insert-at-0 races).
 */
export function looksLikeConcatenatedFileContent(
  proposed: string,
  existingHttp: string | undefined
): boolean {
  if (existingHttp !== undefined && proposed === existingHttp) return false;

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
    if (file.content === existing) continue;
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
 * After a client websocket update, restore authoritative HTTP text when the room
 * doc looks concatenated. Seed/replace only — never append a second copy.
 */
export function repairConcatenatedRoomText(
  doc: Doc,
  authoritativeByPath: Map<string, string>,
  origin: unknown
): boolean {
  if (origin === PERSIST_ACK_ORIGIN) return false;

  let repaired = false;
  for (const [path, httpContent] of authoritativeByPath) {
    const shared = doc.get(path);
    if (!isYTextLike(shared)) continue;

    const roomContent = shared.toString();
    if (roomContent === httpContent) continue;
    if (!looksLikeConcatenatedFileContent(roomContent, httpContent)) continue;

    replaceYTextContent(shared, httpContent);
    repaired = true;
  }
  return repaired;
}
