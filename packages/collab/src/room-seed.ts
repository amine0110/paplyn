import type postgres from "postgres";
import type { Doc } from "./yjs.js";
import {
  collapseConcatenatedSeedContent,
  countDuplicateBibKeys,
  hasMultipleDocumentCopies,
  looksLikeConcatenatedFileContent,
} from "./document-integrity.js";
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

function resolveSeedContent(path: string, content: string): string | null {
  if (!looksLikeConcatenatedFileContent(content, "") && !hasMultipleDocumentCopies(content)) {
    return content;
  }
  const collapsed = collapseConcatenatedSeedContent(path, content);
  if (collapsed) return collapsed;
  console.error(
    `[collab] refuse seed for ${path}: HTTP content looks concatenated and could not be collapsed`
  );
  return null;
}

/**
 * Seed Y.Text from HTTP-persisted project files.
 * Runs once per room bind on the collab server so tabs cannot race to insert
 * the same `initialContent` into Y.Text (concurrent Yjs inserts concatenate).
 *
 * Rules:
 * - Never insert when Y.Text already has content (replace/no-op only).
 * - Never insert concatenated HTTP without collapsing to a single copy first.
 * - Replace concatenated room text with clean HTTP on re-bind.
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
    const ytextContent = ytext.toString();
    const ext = file.path.includes(".") ? file.path.slice(file.path.lastIndexOf(".") + 1).toLowerCase() : "";

    if (ytext.length === 0) {
      const seedContent = resolveSeedContent(file.path, file.content);
      if (!seedContent) continue;
      ytext.insert(0, seedContent);
      seeded += 1;
      continue;
    }

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

    if (
      hasMultipleDocumentCopies(ytextContent) &&
      !hasMultipleDocumentCopies(file.content) &&
      file.content.length > 0
    ) {
      if (ytextContent !== file.content) {
        replaceYTextContent(ytext, file.content);
        seeded += 1;
      }
      continue;
    }

    if (
      isHttpNewerThanCollabRoom(file, options.collabRoomUpdatedAt) &&
      ytextContent !== file.content
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
