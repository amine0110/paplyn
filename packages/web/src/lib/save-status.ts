/** Mirrors collab server persistence debounce (packages/collab/src/persistence.ts). */
export const COLLAB_SAVE_DEBOUNCE_MS = 2000;
export const COLLAB_SAVE_MAX_WAIT_MS = 10000;

/** Matches collab server persist ack map (packages/collab/src/persistence.ts). */
export const PERSIST_META_MAP = "_meta";
export const PERSIST_ACK_FIELD = "persistedAt";
/** Yjs transaction origin for persist ack — must not mark the doc dirty on the client. */
export const PERSIST_ACK_ORIGIN = "persist-ack";

/** Sustained disconnect before failing an in-flight save (after initial sync). */
export const COLLAB_CONNECTION_LOST_MS = 5000;

export type SaveStatus = "syncing" | "saved" | "saving" | "failed";

export function getSaveStatusLabel(status: SaveStatus): string {
  if (status === "syncing") return "Syncing…";
  if (status === "saving") return "Saving…";
  if (status === "failed") return "Save failed";
  return "Saved";
}

export type SaveStatusTrackerOptions = {
  /** After this many ms in "saving" without markSaved, markFailed. 0 disables. */
  ackTimeoutMs?: number;
  /** Initial UI status; collab clients should start as "syncing", not "saved". */
  initialStatus?: SaveStatus;
  /** When false, local doc updates are ignored (not persistable yet). */
  isSynced?: () => boolean;
  /** When false after grace period while saving, markFailed. */
  isConnected?: () => boolean;
  /** Ms to stay disconnected after sync before failing in-flight saves. */
  connectionLostGraceMs?: number;
};

export function createSaveStatusTracker(
  onChange: (status: SaveStatus) => void,
  options: SaveStatusTrackerOptions = {}
) {
  const ackTimeoutMs = options.ackTimeoutMs ?? COLLAB_SAVE_MAX_WAIT_MS;
  const connectionLostGraceMs = options.connectionLostGraceMs ?? COLLAB_CONNECTION_LOST_MS;
  let status: SaveStatus = options.initialStatus ?? "saved";
  let hasBeenSynced = status !== "syncing";
  let ackTimer: ReturnType<typeof setTimeout> | undefined;
  let connectionLostTimer: ReturnType<typeof setTimeout> | undefined;

  const clearAckTimer = () => {
    if (ackTimer !== undefined) {
      clearTimeout(ackTimer);
      ackTimer = undefined;
    }
  };

  const clearConnectionLostTimer = () => {
    if (connectionLostTimer !== undefined) {
      clearTimeout(connectionLostTimer);
      connectionLostTimer = undefined;
    }
  };

  const setStatus = (next: SaveStatus) => {
    if (status === next) return;
    status = next;
    onChange(next);
  };

  const markFailed = () => {
    clearAckTimer();
    clearConnectionLostTimer();
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
    if (options.isSynced && !options.isSynced()) return;
    setStatus("saving");
    startAckTimer();
  };

  const onDocUpdate = (origin: unknown, remoteOrigin: unknown) => {
    if (origin === remoteOrigin) return;
    if (origin === PERSIST_ACK_ORIGIN) return;
    markDirty();
  };

  const onSynced = () => {
    hasBeenSynced = true;
    if (status === "syncing") {
      setStatus("saved");
    }
  };

  const onConnectionLost = () => {
    clearConnectionLostTimer();
    if (!hasBeenSynced || status !== "saving") return;
    connectionLostTimer = setTimeout(() => {
      if (status === "saving" && options.isConnected && !options.isConnected()) {
        markFailed();
      }
    }, connectionLostGraceMs);
  };

  const onConnectionRestored = () => {
    clearConnectionLostTimer();
  };

  const destroy = () => {
    clearAckTimer();
    clearConnectionLostTimer();
  };

  onChange(status);

  return {
    onDocUpdate,
    markSaved,
    markFailed,
    markDirty,
    onSynced,
    onConnectionLost,
    onConnectionRestored,
    destroy,
  };
}
