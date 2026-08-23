import type * as Y from "yjs";

/**
 * Initial CodeMirror document when live collab is enabled.
 * Never fall back to HTTP `initialContent` here — that caused CM + Y.Text double-seed
 * (yCollab would append Y.Text inserts onto an editor already filled from HTTP).
 */
export function getCollabEditorInitialDoc(ytextContent: string): string {
  return ytextContent;
}

/** Initial CodeMirror document when collab is disabled (local-only editing). */
export function getOfflineEditorInitialDoc(ytextContent: string, initialContent: string): string {
  return ytextContent || initialContent;
}

/**
 * Whether a collab client should seed Y.Text from HTTP content.
 * Production rooms are seeded authoritatively on the collab server from `project_file`;
 * client seeding is only for in-memory / no-persistence dev fallback.
 */
export function shouldClientSeedYText(
  collabEnabled: boolean,
  ytextLength: number,
  initialContent: string,
  hasSeededThisSession: boolean
): boolean {
  if (collabEnabled) return false;
  if (hasSeededThisSession) return false;
  return ytextLength === 0 && initialContent.length > 0;
}

/**
 * Seed Y.Text from HTTP content when allowed. Returns true when an insert was applied.
 * Mutates `ytext` in place.
 */
export function seedYTextIfEmpty(ytext: Y.Text, initialContent: string): boolean {
  if (ytext.length > 0 || initialContent.length === 0) return false;
  ytext.insert(0, initialContent);
  return true;
}

/**
 * Simulates the pre-fix client path: CM seeded from HTTP while Y.Text is empty, then
 * Y.Text seeded on sync — the combination that doubled buffer length before autosave.
 */
export function simulateBuggyCollabBuffer(
  ytextContent: string,
  initialContent: string,
  seedYTextOnSync: boolean
): string {
  const cmBuffer = ytextContent || initialContent;
  if (seedYTextOnSync && ytextContent.length === 0 && initialContent.length > 0) {
    // yCollab applies the Y.Text insert onto a CM doc that already contains HTTP content.
    if (cmBuffer.length > 0) {
      return cmBuffer + initialContent;
    }
    return initialContent;
  }
  return cmBuffer;
}

/**
 * Simulates the fixed path: CM starts from Y.Text only; HTTP seeds Y.Text at most once.
 */
export function simulateFixedCollabBuffer(
  ytextContent: string,
  initialContent: string,
  seedYTextOnSync: boolean
): string {
  const cmBuffer = ytextContent;
  let ytext = ytextContent;
  if (seedYTextOnSync && ytext.length === 0 && initialContent.length > 0) {
    ytext = initialContent;
  }
  return cmBuffer.length > 0 ? cmBuffer : ytext;
}
