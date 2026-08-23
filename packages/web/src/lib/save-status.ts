/** Mirrors collab server persistence debounce (packages/collab/src/persistence.ts). */
export const COLLAB_SAVE_DEBOUNCE_MS = 2000;
export const COLLAB_SAVE_MAX_WAIT_MS = 10000;

/** Matches collab server persist ack map (packages/collab/src/persistence.ts). */
export const PERSIST_META_MAP = "_meta";
export const PERSIST_ACK_FIELD = "persistedAt";

export type SaveStatus = "saved" | "saving" | "failed";

export function getSaveStatusLabel(status: SaveStatus): string {
  if (status === "saving") return "Saving…";
  if (status === "failed") return "Save failed";
  return "Saved";
}

export function createSaveStatusTracker(onChange: (status: SaveStatus) => void) {
  let status: SaveStatus = "saved";

  const setStatus = (next: SaveStatus) => {
    if (status === next) return;
    status = next;
    onChange(next);
  };

  const markSaved = () => {
    setStatus("saved");
  };

  const markFailed = () => {
    setStatus("failed");
  };

  const markDirty = () => {
    setStatus("saving");
  };

  const onDocUpdate = (origin: unknown, remoteOrigin: unknown) => {
    if (origin === remoteOrigin) return;
    markDirty();
  };

  const destroy = () => {
    // no-op — timers removed; status reflects real persist only
  };

  return { onDocUpdate, markSaved, markFailed, markDirty, destroy };
}
