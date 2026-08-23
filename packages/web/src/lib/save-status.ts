/** Mirrors collab server persistence debounce (packages/collab/src/persistence.ts). */
export const COLLAB_SAVE_DEBOUNCE_MS = 2000;
export const COLLAB_SAVE_MAX_WAIT_MS = 10000;

export type SaveStatus = "saved" | "saving";

export function getSaveStatusLabel(status: SaveStatus): string {
  return status === "saving" ? "Saving…" : "Saved";
}

export function createSaveStatusTracker(onChange: (status: SaveStatus) => void) {
  let status: SaveStatus = "saved";
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (next: SaveStatus) => {
    if (status === next) return;
    status = next;
    onChange(next);
  };

  const clearTimers = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (maxWaitTimer) clearTimeout(maxWaitTimer);
    debounceTimer = undefined;
    maxWaitTimer = undefined;
  };

  const markSaved = () => {
    clearTimers();
    setStatus("saved");
  };

  const markDirty = () => {
    setStatus("saving");
    if (!debounceTimer) {
      debounceTimer = setTimeout(markSaved, COLLAB_SAVE_DEBOUNCE_MS);
    }
    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(markSaved, COLLAB_SAVE_MAX_WAIT_MS);
    }
  };

  const onDocUpdate = (origin: unknown, remoteOrigin: unknown) => {
    if (origin === remoteOrigin) return;
    markDirty();
  };

  const destroy = () => {
    clearTimers();
  };

  return { onDocUpdate, markSaved, markDirty, destroy };
}
