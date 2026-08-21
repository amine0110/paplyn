import type { Project, ProjectFile } from "./schema";
import { isFolderPlaceholder } from "./project-files";

export const SUPPORTED_COMPILERS = ["pdflatex", "xelatex", "lualatex"] as const;
export type SupportedCompiler = (typeof SUPPORTED_COMPILERS)[number];

export interface ProjectSettingsInput {
  name?: unknown;
  description?: unknown;
  mainFile?: unknown;
  compiler?: unknown;
  archived?: unknown;
}

export interface ProjectSettingsUpdate {
  name?: string;
  description?: string | null;
  mainFile?: string;
  compiler?: SupportedCompiler;
  archived?: boolean;
}

export function isSupportedCompiler(value: string): value is SupportedCompiler {
  return (SUPPORTED_COMPILERS as readonly string[]).includes(value);
}

export function listTexFiles(filePaths: string[]): string[] {
  return filePaths
    .filter((path) => path.endsWith(".tex") && !isFolderPlaceholder(path))
    .sort((a, b) => a.localeCompare(b));
}

/** Prefer `main.tex` (any folder); otherwise the first .tex path alphabetically. */
export function detectMainTexFile(texPaths: string[]): string | null {
  if (texPaths.length === 0) return null;

  const sorted = [...texPaths].sort((a, b) => a.localeCompare(b));

  const main = sorted.find((path) => {
    const slash = path.lastIndexOf("/");
    const base = slash === -1 ? path : path.slice(slash + 1);
    return base === "main.tex";
  });
  if (main) return main;

  return sorted[0] ?? null;
}

export function validateProjectSettingsUpdate(
  input: ProjectSettingsInput,
  texFiles: string[]
): { ok: true; data: ProjectSettingsUpdate } | { ok: false; error: string } {
  const update: ProjectSettingsUpdate = {};

  if ("name" in input && input.name !== undefined) {
    if (typeof input.name !== "string") {
      return { ok: false, error: "Name must be a string" };
    }
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name cannot be empty" };
    if (name.length > 200) return { ok: false, error: "Name must be 200 characters or fewer" };
    update.name = name;
  }

  if ("description" in input && input.description !== undefined) {
    if (input.description === null) {
      update.description = null;
    } else if (typeof input.description === "string") {
      const description = input.description.trim();
      if (description.length > 2000) {
        return { ok: false, error: "Description must be 2000 characters or fewer" };
      }
      update.description = description || null;
    } else {
      return { ok: false, error: "Description must be a string or null" };
    }
  }

  if ("mainFile" in input && input.mainFile !== undefined) {
    if (typeof input.mainFile !== "string") {
      return { ok: false, error: "Main file must be a string" };
    }
    const mainFile = input.mainFile.trim();
    if (!mainFile.endsWith(".tex")) {
      return { ok: false, error: "Main file must be a .tex file" };
    }
    if (!texFiles.includes(mainFile)) {
      return { ok: false, error: "Main file must exist in the project" };
    }
    update.mainFile = mainFile;
  }

  if ("compiler" in input && input.compiler !== undefined) {
    if (typeof input.compiler !== "string" || !isSupportedCompiler(input.compiler)) {
      return {
        ok: false,
        error: `Compiler must be one of: ${SUPPORTED_COMPILERS.join(", ")}`,
      };
    }
    update.compiler = input.compiler;
  }

  if ("archived" in input && input.archived !== undefined) {
    if (typeof input.archived !== "boolean") {
      return { ok: false, error: "Archived must be a boolean" };
    }
    update.archived = input.archived;
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "No valid fields to update" };
  }

  return { ok: true, data: update };
}

export function duplicateProjectName(sourceName: string): string {
  const trimmed = sourceName.trim();
  if (!trimmed) return "Untitled (copy)";
  return trimmed.endsWith(" (copy)") ? trimmed : `${trimmed} (copy)`;
}

export interface DuplicateProjectSeed {
  sourceProject: Pick<
    Project,
    "name" | "description" | "mainFile" | "compiler" | "template"
  >;
  sourceFiles: Pick<ProjectFile, "path" | "content" | "isBinary">[];
  newProjectId: string;
  ownerId: string;
}

export function buildDuplicateProjectSeed({
  sourceProject,
  sourceFiles,
  newProjectId,
  ownerId,
}: DuplicateProjectSeed) {
  const compiler = isSupportedCompiler(sourceProject.compiler)
    ? sourceProject.compiler
    : "pdflatex";

  return {
    project: {
      id: newProjectId,
      name: duplicateProjectName(sourceProject.name),
      description: sourceProject.description,
      ownerId,
      mainFile: sourceProject.mainFile,
      compiler,
      template: sourceProject.template,
      archived: false,
    },
    files: sourceFiles.map((file) => ({
      projectId: newProjectId,
      path: file.path,
      content: file.content,
      isBinary: file.isBinary,
    })),
  };
}
