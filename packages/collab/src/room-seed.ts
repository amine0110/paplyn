import type postgres from "postgres";
import type { Doc, Text } from "./yjs.js";
import { hasMultipleDocumentCopies, countDuplicateBibKeys } from "./document-integrity.js";
import { replaceYTextContent } from "./y-text.js";

export type ProjectFileRow = {
  path: string;
  content: string;
  is_binary: boolean;
  updated_at?: Date | null;
};

export type SeedRoomOptions = {
  /** When set, HTTP rows newer than this timestamp may replace stale Y.Text. */
  collabRoomUpdatedAt?: Date | null;
};

/**
 * Load text project files for a room (project id) from Postgres.
 */
export async function loadProjectFilesForRoom(
  sql: postgres.Sql,
  roomId: string
): Promise<ProjectFileRow[]> {
  return sql<ProjectFileRow[]>`
    SELECT path, content, is_binary, updated_at
    FROM project_file
    WHERE project_id = ${roomId} AND is_binary = false
  `;
}

function isHttpNewerThanCollabRoom(file: ProjectFileRow, collabRoomUpdatedAt?: Date | null): boolean {
  if (!file.updated_at || !collabRoomUpdatedAt) return false;
  return file.updated_at > collabRoomUpdatedAt;
}

/**
 * Seed empty Y.Text entries from HTTP-persisted project files.
 * Runs once per room bind on the collab server so tabs cannot race to insert
 * the same `initialContent` into Y.Text (concurrent Yjs inserts concatenate).
 *
 * When HTTP `project_file` is newer than the stored collab room blob, adopt HTTP
 * content if it differs — avoids ignoring a newer HTTP save forever (#66).
 */
export function seedDocFromProjectFiles(
  doc: Doc,
  files: ProjectFileRow[],
  options: SeedRoomOptions = {}
): number {
  let seeded = 0;
  for (const file of files) {
    if (file.is_binary || !file.content) continue;
    const ytext = doc.getText(file.path);
    if (ytext.length === 0) {
      ytext.insert(0, file.content);
      seeded += 1;
      continue;
    }

    const ytextContent = ytext.toString();
    const httpIsCleanTex = !hasMultipleDocumentCopies(file.content);
    const ytextIsConcatenatedTex = hasMultipleDocumentCopies(ytextContent);
    const ext = file.path.includes(".") ? file.path.slice(file.path.lastIndexOf(".") + 1).toLowerCase() : "";

    if (
      ext === "bib" &&
      countDuplicateBibKeys(ytextContent) > 0 &&
      countDuplicateBibKeys(file.content) === 0 &&
      file.content.length > 0
    ) {
      if (ytextContent !== file.content) {
        replaceYTextContent(ytext, file.content);
        seeded += 1;
      }
      continue;
    }

    // Stale client Yjs replay after HTTP restore: replace concatenated room text with HTTP.
    if (ytextIsConcatenatedTex && httpIsCleanTex && file.content.length > 0) {
      if (ytextContent !== file.content) {
        replaceYTextContent(ytext, file.content);
        seeded += 1;
      }
      continue;
    }

    if (
      isHttpNewerThanCollabRoom(file, options.collabRoomUpdatedAt) &&
      ytext.toString() !== file.content
    ) {
      replaceYTextContent(ytext, file.content);
      seeded += 1;
    }
  }
  return seeded;
}

export async function seedRoomFromProjectFiles(
  sql: postgres.Sql,
  roomId: string,
  doc: Doc,
  options: SeedRoomOptions = {}
): Promise<number> {
  const files = await loadProjectFilesForRoom(sql, roomId);
  return seedDocFromProjectFiles(doc, files, options);
}
