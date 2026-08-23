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

export type SaveStatusTrackerOptions = {
  /** After this many ms in "saving" without markSaved, markFailed. 0 disables. */
  ackTimeoutMs?: number;
  /** When false at markDirty time, fail immediately instead of showing Saving…. */
  isConnected?: () => boolean;
};

export function createSaveStatusTracker(
  onChange: (status: SaveStatus) => void,
  options: SaveStatusTrackerOptions = {}
) {
  const ackTimeoutMs = options.ackTimeoutMs ?? COLLAB_SAVE_MAX_WAIT_MS;
  let status: SaveStatus = "saved";
  let ackTimer: ReturnType<typeof setTimeout> | undefined;

  const clearAckTimer = () => {
    if (ackTimer !== undefined) {
      clearTimeout(ackTimer);
      ackTimer = undefined;
    }
  };

  const setStatus = (next: SaveStatus) => {
    if (status === next) return;
    status = next;
    onChange(next);
  };

  const markFailed = () => {
    clearAckTimer();
    setStatus("failed");
  };

  const startAckTimer = () => {
    clearAckTimer();
    if (ackTimeoutMs <= 0 || status !== "saving") return;
    ackTimer = setTimeout(() => {
      if (status === "saving") {
        markFailed();
      }
    }, ackTimeoutMs);
  };

  const markSaved = () => {
    clearAckTimer();
    setStatus("saved");
  };

  const markDirty = () => {
    if (options.isConnected && !options.isConnected()) {
      markFailed();
      return;
    }
    setStatus("saving");
    startAckTimer();
  };

  const onDocUpdate = (origin: unknown, remoteOrigin: unknown) => {
    if (origin === remoteOrigin) return;
    markDirty();
  };

  const onConnectionLost = () => {
    if (status === "saving") {
      markFailed();
    }
  };

  const destroy = () => {
    clearAckTimer();
  };

  return { onDocUpdate, markSaved, markFailed, markDirty, onConnectionLost, destroy };
}
