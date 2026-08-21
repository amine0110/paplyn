import * as Y from "yjs";
import postgres from "postgres";

const SAVE_DEBOUNCE_MS = parseInt(process.env.COLLAB_SAVE_DEBOUNCE_MS || "2000", 10);
const SAVE_MAX_WAIT_MS = parseInt(process.env.COLLAB_SAVE_MAX_WAIT_MS || "10000", 10);

/** Encode a Yjs document as a binary update suitable for storage. */
export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** Restore a Yjs document from a stored binary update. */
export function applyDocState(doc: Y.Doc, state: Uint8Array): void {
  Y.applyUpdate(doc, state);
}

/** Decode a base64-encoded update from Postgres. */
export function decodeStoredState(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, "base64"));
}

/** Encode a binary update for Postgres text storage. */
export function encodeStoredState(state: Uint8Array): string {
  return Buffer.from(state).toString("base64");
}

/** True when the document has no shared types with content. */
export function isDocEmpty(doc: Y.Doc): boolean {
  return doc.store.clients.size === 0;
}

type DebouncedSave = {
  schedule: () => void;
  flush: () => Promise<void>;
  cancel: () => void;
};

function createDebouncedSave(fn: () => Promise<void>, waitMs: number, maxWaitMs: number): DebouncedSave {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let pending: Promise<void> | undefined;

  const run = () => {
    timer = undefined;
    maxTimer = undefined;
    pending = fn().catch((err) => {
      console.error("[collab] persistence save failed:", err);
    });
    return pending;
  };

  return {
    schedule() {
      if (!timer) {
        timer = setTimeout(run, waitMs);
      }
      if (!maxTimer) {
        maxTimer = setTimeout(run, maxWaitMs);
      }
    },
    async flush() {
      if (timer) clearTimeout(timer);
      if (maxTimer) clearTimeout(maxTimer);
      timer = undefined;
      maxTimer = undefined;
      if (pending) await pending;
      await run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      if (maxTimer) clearTimeout(maxTimer);
      timer = undefined;
      maxTimer = undefined;
    },
  };
}

export async function loadRoomState(sql: postgres.Sql, roomId: string): Promise<Uint8Array | null> {
  const rows = await sql<{ state: string }[]>`
    SELECT state FROM collab_room WHERE room_id = ${roomId}
  `;
  if (rows.length === 0 || !rows[0].state) return null;
  return decodeStoredState(rows[0].state);
}

export async function saveRoomState(sql: postgres.Sql, roomId: string, state: Uint8Array): Promise<void> {
  const encoded = encodeStoredState(state);
  await sql`
    INSERT INTO collab_room (room_id, state, updated_at)
    VALUES (${roomId}, ${encoded}, NOW())
    ON CONFLICT (room_id) DO UPDATE SET
      state = EXCLUDED.state,
      updated_at = EXCLUDED.updated_at
  `;
}

export type CollabPersistence = {
  bindState: (roomId: string, doc: Y.Doc) => Promise<void>;
  writeState: (roomId: string, doc: Y.Doc) => Promise<void>;
};

export function createPostgresPersistence(sql: postgres.Sql): CollabPersistence {
  const debouncedByRoom = new Map<string, DebouncedSave>();

  return {
    async bindState(roomId, doc) {
      const stored = await loadRoomState(sql, roomId);
      if (stored && stored.length > 0) {
        applyDocState(doc, stored);
      }

      const debounced = createDebouncedSave(
        async () => {
          await saveRoomState(sql, roomId, encodeDocState(doc));
        },
        SAVE_DEBOUNCE_MS,
        SAVE_MAX_WAIT_MS
      );
      debouncedByRoom.set(roomId, debounced);

      doc.on("update", () => {
        debounced.schedule();
      });
    },

    async writeState(roomId, doc) {
      const debounced = debouncedByRoom.get(roomId);
      if (debounced) {
        debounced.cancel();
        debouncedByRoom.delete(roomId);
      }
      await saveRoomState(sql, roomId, encodeDocState(doc));
    },
  };
}
