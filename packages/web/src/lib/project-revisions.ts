import type { Project, ProjectFile } from "./schema";

export const DEFAULT_MAX_REVISIONS = 20;

export type RevisionSource = "compile" | "manual";

export interface RevisionFileSnapshot {
  path: string;
  content: string;
  isBinary: boolean;
}

export interface ProjectRevisionSnapshot {
  mainFile: string;
  compiler: string;
  files: RevisionFileSnapshot[];
  pdf?: string | null;
}

export interface RevisionListItem {
  id: string;
  label: string;
  source: RevisionSource;
  createdAt: string;
  userId: string;
  mainFile: string;
  compiler: string;
  fileCount: number;
  hasPdf: boolean;
}

export function buildRevisionLabel(source: RevisionSource, customLabel?: string | null): string {
  const trimmed = customLabel?.trim();
  if (trimmed) return trimmed.slice(0, 200);
  return source === "compile" ? "Successful compile" : "Manual snapshot";
}

export function buildRevisionSnapshot(
  project: Pick<Project, "mainFile" | "compiler">,
  files: Pick<ProjectFile, "path" | "content" | "isBinary">[],
  pdf?: string | null
): ProjectRevisionSnapshot {
  return {
    mainFile: project.mainFile,
    compiler: project.compiler,
    files: files.map((file) => ({
      path: file.path,
      content: file.content,
      isBinary: file.isBinary,
    })),
    pdf: pdf ?? null,
  };
}

export function parseRevisionSnapshot(value: unknown): ProjectRevisionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<ProjectRevisionSnapshot>;
  if (typeof snapshot.mainFile !== "string" || typeof snapshot.compiler !== "string") {
    return null;
  }
  if (!Array.isArray(snapshot.files)) return null;

  const files: RevisionFileSnapshot[] = [];
  for (const entry of snapshot.files) {
    if (!entry || typeof entry !== "object") return null;
    const file = entry as Partial<RevisionFileSnapshot>;
    if (
      typeof file.path !== "string" ||
      typeof file.content !== "string" ||
      typeof file.isBinary !== "boolean"
    ) {
      return null;
    }
    files.push({
      path: file.path,
      content: file.content,
      isBinary: file.isBinary,
    });
  }

  return {
    mainFile: snapshot.mainFile,
    compiler: snapshot.compiler,
    files,
    pdf: typeof snapshot.pdf === "string" ? snapshot.pdf : null,
  };
}

/** Given revision ids sorted newest-first, return ids that exceed the retention limit. */
export function revisionIdsToPrune(
  revisionIdsNewestFirst: string[],
  maxRevisions: number = DEFAULT_MAX_REVISIONS
): string[] {
  if (maxRevisions < 1) {
    return revisionIdsNewestFirst.length > 0 ? [...revisionIdsNewestFirst] : [];
  }
  if (revisionIdsNewestFirst.length <= maxRevisions) return [];
  return revisionIdsNewestFirst.slice(maxRevisions);
}

export interface RestorePlan {
  filesToUpsert: RevisionFileSnapshot[];
  pathsToDelete: string[];
  mainFile: string;
  compiler: string;
  pdf: string | null;
}

export function buildRestorePlan(
  snapshot: ProjectRevisionSnapshot,
  currentFilePaths: string[]
): RestorePlan {
  const snapshotPaths = new Set(snapshot.files.map((file) => file.path));
  return {
    filesToUpsert: snapshot.files,
    pathsToDelete: currentFilePaths.filter((path) => !snapshotPaths.has(path)),
    mainFile: snapshot.mainFile,
    compiler: snapshot.compiler,
    pdf: snapshot.pdf ?? null,
  };
}

export function toRevisionListItem(revision: {
  id: string;
  label: string | null;
  source: string;
  createdAt: Date;
  userId: string;
  mainFile: string;
  compiler: string;
  files: unknown;
  pdf: string | null;
}): RevisionListItem {
  const files = Array.isArray(revision.files) ? revision.files : [];
  return {
    id: revision.id,
    label: buildRevisionLabel(
      revision.source === "manual" ? "manual" : "compile",
      revision.label
    ),
    source: revision.source === "manual" ? "manual" : "compile",
    createdAt: revision.createdAt.toISOString(),
    userId: revision.userId,
    mainFile: revision.mainFile,
    compiler: revision.compiler,
    fileCount: files.length,
    hasPdf: !!revision.pdf,
  };
}
