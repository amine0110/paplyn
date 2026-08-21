import { describe, it, expect } from "vitest";
import {
  LATEX_ENGINES,
  buildEngineArgs,
  detectBibliographyTool,
  extractToolErrors,
  getTexBaseName,
  hasBibFiles,
  isLatexEngine,
  logRequestsBibliography,
  needsBibliographyPass,
  parseBibliographyErrors,
} from "./compile.js";
import type { ProjectFile } from "./types.js";

describe("latex engine helpers", () => {
  it("accepts supported engines", () => {
    expect(LATEX_ENGINES).toEqual(["pdflatex", "xelatex", "lualatex"]);
    expect(isLatexEngine("pdflatex")).toBe(true);
    expect(isLatexEngine("xelatex")).toBe(true);
    expect(isLatexEngine("lualatex")).toBe(true);
    expect(isLatexEngine("latexmk")).toBe(false);
  });

  it("builds nonstopmode engine args with synctex and output directory", () => {
    expect(buildEngineArgs("/tmp/work/main.tex", "/tmp/work")).toEqual([
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-synctex=1",
      "-output-directory",
      "/tmp/work",
      "/tmp/work/main.tex",
    ]);
  });

  it("derives the TeX job name from the main file", () => {
    expect(getTexBaseName("main.tex")).toBe("main");
    expect(getTexBaseName("chapters/intro.tex")).toBe("chapters/intro");
  });
});

describe("bibliography detection", () => {
  const files: ProjectFile[] = [
    { path: "main.tex", content: "\\documentclass{article}\\bibliography{refs}" },
    { path: "refs.bib", content: "@article{a, title={A}}" },
  ];

  it("detects .bib files", () => {
    expect(hasBibFiles(files)).toBe(true);
    expect(hasBibFiles([{ path: "main.tex", content: "" }])).toBe(false);
  });

  it("detects bibliography reruns from the LaTeX log", () => {
    expect(logRequestsBibliography("No file main.bbl.")).toBe(true);
    expect(logRequestsBibliography("Rerun to get citations correct.")).toBe(true);
    expect(logRequestsBibliography("Output written on main.pdf")).toBe(false);
  });

  it("chooses bibtex for legacy bibliography commands", () => {
    expect(detectBibliographyTool(files, "main.tex")).toBe("bibtex");
  });

  it("chooses biber for biblatex projects", () => {
    const biblatexFiles: ProjectFile[] = [
      {
        path: "main.tex",
        content: "\\usepackage{biblatex}\\addbibresource{refs.bib}",
      },
      { path: "refs.bib", content: "" },
    ];

    expect(detectBibliographyTool(biblatexFiles, "main.tex", { hasBcf: true })).toBe("biber");
  });

  it("needs a bibliography pass when aux or bcf data exists", () => {
    expect(needsBibliographyPass(files, "")).toBe(true);
    expect(needsBibliographyPass([], "No file main.bbl.")).toBe(true);
    expect(
      needsBibliographyPass([], "", "\\citation{smith2020}\\bibdata{refs}\\bibstyle{plain}")
    ).toBe(true);
    expect(needsBibliographyPass([], "", undefined, true)).toBe(true);
    expect(needsBibliographyPass([], "Output written on main.pdf")).toBe(false);
  });
});

describe("extractToolErrors", () => {
  it("detects spawn ENOENT failures", () => {
    const errors = extractToolErrors("\n--- pdflatex pass 1 ---\n\nspawn pdflatex ENOENT");
    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe("error");
    expect(errors[0].message).toContain("pdflatex");
    expect(errors[0].message).toContain("not found");
  });

  it("detects missing bibliography tools", () => {
    const errors = extractToolErrors("\n--- biber ---\n\nspawn biber ENOENT");
    expect(errors[0].message).toContain("biber");
  });

  it("returns no errors for normal LaTeX log output", () => {
    const errors = extractToolErrors("This is pdfTeX, Version 3.141592653\nOutput written on main.pdf");
    expect(errors).toHaveLength(0);
  });
});

describe("parseBibliographyErrors", () => {
  it("parses BibTeX warnings and line errors", () => {
    const log = [
      "--- bibtex ---",
      "Warning--I didn't find a database entry for \"missing\"",
      "---line 4 of file refs.bib---",
      "I was expecting a `,' or a `}'",
    ].join("\n");

    const errors = parseBibliographyErrors(log, "bibtex");
    expect(errors.some((e) => e.severity === "warning" && e.message.includes("missing"))).toBe(true);
    expect(errors.some((e) => e.severity === "error" && e.file === "refs.bib" && e.line === 4)).toBe(
      true
    );
  });

  it("parses Biber errors and warnings", () => {
    const log = [
      "--- biber ---",
      "INFO - This is Biber 2.19",
      "WARN - I didn't find a database entry for 'missing' (section 0)",
      "ERROR - BibTeX subsystem: syntax error",
    ].join("\n");

    const errors = parseBibliographyErrors(log, "biber");
    expect(errors.filter((e) => e.severity === "warning")).toHaveLength(1);
    const biberErrors = errors.filter((e) => e.severity === "error");
    expect(biberErrors).toHaveLength(1);
    expect(biberErrors[0].message).toContain("syntax error");
  });
});
