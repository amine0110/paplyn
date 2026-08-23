import * as Y from "yjs";
import type postgres from "postgres";

export type ProjectFileRow = {
  path: string;
  content: string;
  is_binary: boolean;
};

/**
 * Load text project files for a room (project id) from Postgres.
 */
export async function loadProjectFilesForRoom(
  sql: postgres.Sql,
  roomId: string
): Promise<ProjectFileRow[]> {
  return sql<ProjectFileRow[]>`
    SELECT path, content, is_binary
    FROM project_file
    WHERE project_id = ${roomId} AND is_binary = false
  `;
}

/**
 * Seed empty Y.Text entries from HTTP-persisted project files.
 * Runs once per room bind on the collab server so tabs cannot race to insert
 * the same `initialContent` into Y.Text (concurrent Yjs inserts concatenate).
 */
export function seedDocFromProjectFiles(doc: Y.Doc, files: ProjectFileRow[]): number {
  let seeded = 0;
  for (const file of files) {
    if (file.is_binary || !file.content) continue;
    const ytext = doc.getText(file.path);
    if (ytext.length > 0) continue;
    ytext.insert(0, file.content);
    seeded += 1;
  }
  return seeded;
}

export async function seedRoomFromProjectFiles(
  sql: postgres.Sql,
  roomId: string,
  doc: Y.Doc
): Promise<number> {
  const files = await loadProjectFilesForRoom(sql, roomId);
  return seedDocFromProjectFiles(doc, files);
}
