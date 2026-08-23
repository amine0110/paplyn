import { randomUUID } from "crypto";
import * as Y from "yjs";
import postgres from "postgres";
import { seedRoomFromProjectFiles } from "./room-seed.js";

const SAVE_DEBOUNCE_MS = parseInt(process.env.COLLAB_SAVE_DEBOUNCE_MS || "2000", 10);
const SAVE_MAX_WAIT_MS = parseInt(process.env.COLLAB_SAVE_MAX_WAIT_MS || "10000", 10);

/** Y.Map key broadcast to clients after a successful room persist. */
export const PERSIST_META_MAP = "_meta";
export const PERSIST_ACK_FIELD = "persistedAt";
/** Yjs transaction origin for persist ack — must not re-trigger debounced save. */
export const PERSIST_ACK_ORIGIN = "persist-ack";

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

/** File extensions synced from Y.Text into HTTP `project_file`. */
export const SYNCABLE_TEXT_EXTENSIONS = new Set(["tex", "bib", "cls", "sty", "txt", "md"]);

/** Extensions treated as binary — never overwrite `project_file` from Y.Text. */
export const BINARY_PATH_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "zip",
  "gz",
  "tar",
  "bz2",
  "7z",
  "ico",
  "bmp",
  "svg",
  "eps",
  "ps",
  "dvi",
  "aux",
  "log",
  "fls",
  "fdb_latexmk",
  "synctex",
]);

export function getPathExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

/** True when the path looks like a binary asset (by extension). */
export function isBinaryCollabPath(path: string): boolean {
  const ext = getPathExtension(path);
  return ext.length > 0 && BINARY_PATH_EXTENSIONS.has(ext);
}

/**
 * True when a Y.Text path may be upserted into HTTP `project_file`.
 * Allows typical LaTeX source paths plus extensionless files.
 */
export function isSyncableTextPath(path: string): boolean {
  if (isBinaryCollabPath(path)) return false;
  const ext = getPathExtension(path);
  if (!ext) return true;
  return SYNCABLE_TEXT_EXTENSIONS.has(ext);
}

/** Extract text file paths and contents from all Y.Text shared types in a room doc. */
export function getTextFilesFromDoc(doc: Y.Doc): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  doc.share.forEach((sharedType, path) => {
    if (sharedType instanceof Y.Text) {
      files.push({ path, content: sharedType.toString() });
    }
  });
  return files;
}

/** Drop Y.Text entries that must not be written into HTTP `project_file`. */
export function filterSyncableTextFiles(
  files: Array<{ path: string; content: string }>,
  binaryPathsInDb: Set<string>
): Array<{ path: string; content: string }> {
  return files.filter((file) => {
    if (binaryPathsInDb.has(file.path)) return false;
    return isSyncableTextPath(file.path);
  });
}

async function loadBinaryProjectPaths(sql: postgres.Sql, projectId: string): Promise<Set<string>> {
  const rows = await sql<{ path: string }[]>`
    SELECT path FROM project_file
    WHERE project_id = ${projectId} AND is_binary = true
  `;
  return new Set(rows.map((row) => row.path));
}

/** Upsert HTTP `project_file` rows from the current Yjs room document. */
export async function syncProjectFilesFromDoc(
  sql: postgres.Sql,
  projectId: string,
  doc: Y.Doc
): Promise<void> {
  const binaryPaths = await loadBinaryProjectPaths(sql, projectId);
  const files = filterSyncableTextFiles(getTextFilesFromDoc(doc), binaryPaths);
  for (const file of files) {
    const id = randomUUID();
    await sql`
      INSERT INTO project_file (id, project_id, path, content, is_binary, created_at, updated_at)
      VALUES (${id}, ${projectId}, ${file.path}, ${file.content}, false, NOW(), NOW())
      ON CONFLICT (project_id, path)
      DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = EXCLUDED.updated_at
    `;
  }
}

function signalPersistAck(doc: Y.Doc): void {
  doc.transact(() => {
    doc.getMap(PERSIST_META_MAP).set(PERSIST_ACK_FIELD, Date.now());
  }, PERSIST_ACK_ORIGIN);
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

  const persistRoom = async (roomId: string, doc: Y.Doc) => {
    await saveRoomState(sql, roomId, encodeDocState(doc));
    await syncProjectFilesFromDoc(sql, roomId, doc);
    signalPersistAck(doc);
  };

  return {
    async bindState(roomId, doc) {
      const stored = await loadRoomState(sql, roomId);
      if (stored && stored.length > 0) {
        applyDocState(doc, stored);
      }

      // Authoritative one-time seed from HTTP source of truth before clients sync.
      await seedRoomFromProjectFiles(sql, roomId, doc);

      const debounced = createDebouncedSave(
        async () => {
          await persistRoom(roomId, doc);
        },
        SAVE_DEBOUNCE_MS,
        SAVE_MAX_WAIT_MS
      );
      debouncedByRoom.set(roomId, debounced);

      doc.on("update", (_update, origin) => {
        if (origin === PERSIST_ACK_ORIGIN) return;
        debounced.schedule();
      });
    },

    async writeState(roomId, doc) {
      const debounced = debouncedByRoom.get(roomId);
      if (debounced) {
        debounced.cancel();
        debouncedByRoom.delete(roomId);
      }
      await persistRoom(roomId, doc);
    },
  };
}
