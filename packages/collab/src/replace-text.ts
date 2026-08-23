import type postgres from "postgres";
// @ts-expect-error y-websocket utils has no types
import { docs } from "y-websocket/bin/utils";
import Y, { type Doc } from "./yjs.js";
import { replaceYTextContent } from "./y-text.js";
import {
  applyDocState,
  isBinaryCollabPath,
  isSyncableTextPath,
  loadRoomState,
  persistRoomState,
} from "./persistence.js";

export class ReplaceTextError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "ReplaceTextError";
  }
}

export function assertReplaceablePath(path: string): void {
  if (isBinaryCollabPath(path)) {
    throw new ReplaceTextError(`Binary path not allowed: ${path}`, 400);
  }
  if (!isSyncableTextPath(path)) {
    throw new ReplaceTextError(`Path not syncable: ${path}`, 400);
  }
}

/**
 * Replace Y.Text content on the live bound room doc (or load from DB when unbound),
 * persist once, and broadcast to connected WS clients when the room is bound.
 */
export async function replaceTextInRoom(
  sql: postgres.Sql,
  roomId: string,
  path: string,
  content: string
): Promise<{ bound: boolean; mainTexLength: number }> {
  assertReplaceablePath(path);

  const boundDoc = docs.get(roomId) as Doc | undefined;
  if (boundDoc) {
    const ytext = boundDoc.get(path, Y.Text);
    replaceYTextContent(ytext, content);
    await persistRoomState(sql, roomId, boundDoc);
    return { bound: true, mainTexLength: ytext.length };
  }

  const doc = new Y.Doc();
  const stored = await loadRoomState(sql, roomId);
  if (stored && stored.length > 0) {
    applyDocState(doc, stored);
  }

  const ytext = doc.get(path, Y.Text);
  replaceYTextContent(ytext, content);
  await persistRoomState(sql, roomId, doc);
  return { bound: false, mainTexLength: ytext.length };
}
