import { desc, eq, inArray, and } from "drizzle-orm";
import { db } from "./db";
import { project, projectFile, projectRevision } from "./schema";
import {
  DEFAULT_MAX_REVISIONS,
  buildRevisionLabel,
  buildRevisionSnapshot,
  parseRevisionSnapshot,
  revisionIdsToPrune,
  toRevisionListItem,
  type ProjectRevisionSnapshot,
  type RevisionSource,
} from "./project-revisions";
import { generateId } from "./utils";

export async function listProjectRevisions(projectId: string) {
  const rows = await db
    .select()
    .from(projectRevision)
    .where(eq(projectRevision.projectId, projectId))
    .orderBy(desc(projectRevision.createdAt));

  return rows.map(toRevisionListItem);
}

export async function createProjectRevision({
  projectId,
  userId,
  source,
  label,
  pdf,
}: {
  projectId: string;
  userId: string;
  source: RevisionSource;
  label?: string | null;
  pdf?: string | null;
}) {
  const [proj] = await db.select().from(project).where(eq(project.id, projectId)).limit(1);
  if (!proj) return null;

  const files = await db.select().from(projectFile).where(eq(projectFile.projectId, projectId));
  const snapshot = buildRevisionSnapshot(proj, files, pdf);
  const revisionId = generateId();

  await db.insert(projectRevision).values({
    id: revisionId,
    projectId,
    userId,
    label: buildRevisionLabel(source, label),
    source,
    mainFile: snapshot.mainFile,
    compiler: snapshot.compiler,
    files: snapshot.files,
    pdf: snapshot.pdf ?? null,
  });

  await pruneProjectRevisions(projectId);

  const [created] = await db
    .select()
    .from(projectRevision)
    .where(eq(projectRevision.id, revisionId))
    .limit(1);

  return created ? toRevisionListItem(created) : null;
}

export async function pruneProjectRevisions(
  projectId: string,
  maxRevisions: number = DEFAULT_MAX_REVISIONS
) {
  const rows = await db
    .select({ id: projectRevision.id })
    .from(projectRevision)
    .where(eq(projectRevision.projectId, projectId))
    .orderBy(desc(projectRevision.createdAt));

  const idsToDelete = revisionIdsToPrune(
    rows.map((row) => row.id),
    maxRevisions
  );
  if (idsToDelete.length === 0) return;

  await db.delete(projectRevision).where(inArray(projectRevision.id, idsToDelete));
}

export async function getProjectRevision(projectId: string, revisionId: string) {
  const [row] = await db
    .select()
    .from(projectRevision)
    .where(eq(projectRevision.id, revisionId))
    .limit(1);

  if (!row || row.projectId !== projectId) return null;
  return row;
}

export async function restoreProjectRevision({
  projectId,
  revisionId,
}: {
  projectId: string;
  revisionId: string;
}) {
  const row = await getProjectRevision(projectId, revisionId);
  if (!row) return { ok: false as const, error: "Revision not found" };

  const snapshot: ProjectRevisionSnapshot = {
    mainFile: row.mainFile,
    compiler: row.compiler,
    files: Array.isArray(row.files)
      ? (row.files as ProjectRevisionSnapshot["files"])
      : [],
    pdf: row.pdf,
  };

  const parsed = parseRevisionSnapshot(snapshot);
  if (!parsed) return { ok: false as const, error: "Invalid revision snapshot" };

  const currentFiles = await db
    .select()
    .from(projectFile)
    .where(eq(projectFile.projectId, projectId));

  const snapshotPaths = new Set(parsed.files.map((file) => file.path));
  const pathsToDelete = currentFiles
    .map((file) => file.path)
    .filter((path) => !snapshotPaths.has(path));

  for (const path of pathsToDelete) {
    await db
      .delete(projectFile)
      .where(and(eq(projectFile.projectId, projectId), eq(projectFile.path, path)));
  }

  for (const file of parsed.files) {
    const existing = currentFiles.find((entry) => entry.path === file.path);
    if (existing) {
      await db
        .update(projectFile)
        .set({
          content: file.content,
          isBinary: file.isBinary,
          updatedAt: new Date(),
        })
        .where(eq(projectFile.id, existing.id));
    } else {
      await db.insert(projectFile).values({
        id: generateId(),
        projectId,
        path: file.path,
        content: file.content,
        isBinary: file.isBinary,
      });
    }
  }

  const [updatedProject] = await db
    .update(project)
    .set({
      mainFile: parsed.mainFile,
      compiler: parsed.compiler,
      updatedAt: new Date(),
    })
    .where(eq(project.id, projectId))
    .returning();

  const restoredFiles = await db
    .select()
    .from(projectFile)
    .where(eq(projectFile.projectId, projectId));

  return {
    ok: true as const,
    project: updatedProject,
    files: restoredFiles,
    pdf: parsed.pdf ?? null,
  };
}
