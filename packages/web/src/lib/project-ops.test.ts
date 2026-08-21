import { describe, it, expect } from "vitest";
import {
  SUPPORTED_COMPILERS,
  buildDuplicateProjectSeed,
  duplicateProjectName,
  isSupportedCompiler,
  listTexFiles,
  validateProjectSettingsUpdate,
} from "@/lib/project-ops";

describe("project ops helpers", () => {
  it("lists only .tex source files", () => {
    expect(
      listTexFiles(["main.tex", "refs.bib", "chapters/intro.tex", "figures/.keep"])
    ).toEqual(["chapters/intro.tex", "main.tex"]);
  });

  it("accepts supported compilers only", () => {
    expect(SUPPORTED_COMPILERS).toEqual(["pdflatex", "xelatex"]);
    expect(isSupportedCompiler("pdflatex")).toBe(true);
    expect(isSupportedCompiler("xelatex")).toBe(true);
    expect(isSupportedCompiler("lualatex")).toBe(false);
  });

  it("validates project settings updates", () => {
    const texFiles = ["main.tex", "appendix.tex"];

    expect(
      validateProjectSettingsUpdate(
        { name: "  My Paper  ", description: "Draft", mainFile: "appendix.tex", compiler: "xelatex" },
        texFiles
      )
    ).toEqual({
      ok: true,
      data: {
        name: "My Paper",
        description: "Draft",
        mainFile: "appendix.tex",
        compiler: "xelatex",
      },
    });

    expect(validateProjectSettingsUpdate({ mainFile: "missing.tex" }, texFiles)).toEqual({
      ok: false,
      error: "Main file must exist in the project",
    });

    expect(validateProjectSettingsUpdate({ compiler: "lualatex" }, texFiles)).toEqual({
      ok: false,
      error: "Compiler must be one of: pdflatex, xelatex",
    });

    expect(validateProjectSettingsUpdate({ description: null }, texFiles)).toEqual({
      ok: true,
      data: { description: null },
    });
  });

  it("builds duplicate project names", () => {
    expect(duplicateProjectName("Thesis")).toBe("Thesis (copy)");
    expect(duplicateProjectName("Thesis (copy)")).toBe("Thesis (copy)");
    expect(duplicateProjectName("   ")).toBe("Untitled (copy)");
  });

  it("builds duplicate project seed with copied metadata and files", () => {
    const seed = buildDuplicateProjectSeed({
      newProjectId: "new-id",
      ownerId: "user-1",
      sourceProject: {
        name: "Paper",
        description: "Notes",
        mainFile: "main.tex",
        compiler: "xelatex",
        template: "ieee",
      },
      sourceFiles: [
        { path: "main.tex", content: "\\documentclass{article}", isBinary: false },
        { path: "refs.bib", content: "", isBinary: false },
      ],
    });

    expect(seed.project).toMatchObject({
      id: "new-id",
      name: "Paper (copy)",
      description: "Notes",
      ownerId: "user-1",
      mainFile: "main.tex",
      compiler: "xelatex",
      template: "ieee",
      archived: false,
    });
    expect(seed.files).toHaveLength(2);
    expect(seed.files[0]).toMatchObject({
      projectId: "new-id",
      path: "main.tex",
      content: "\\documentclass{article}",
    });
  });

  it("falls back to pdflatex when source compiler is unsupported", () => {
    const seed = buildDuplicateProjectSeed({
      newProjectId: "new-id",
      ownerId: "user-1",
      sourceProject: {
        name: "Paper",
        description: null,
        mainFile: "main.tex",
        compiler: "lualatex",
        template: null,
      },
      sourceFiles: [],
    });

    expect(seed.project.compiler).toBe("pdflatex");
  });
});
