import { describe, expect, it } from "vitest";
import {
  buildBibliographyRelocationActions,
  buildBibliographyRelocationPlan,
  getMisplacedBibliographySite,
  tryBibliographyRecovery,
} from "./ai-compile-fix-bibliography-recovery";
import { detectReferencesRecoveryIntent } from "./ai-compile-fix-bibliography-recovery-patterns";
import { validateBibliographyStructure, validateCompileFixEdit } from "./ai-compile-fix-validation";

/** Live DISSTANCE failure shape: References after author/maketitle, before abstract. */
function buildDamagedDistanceFixture(): string {
  return [
    "\\documentclass[preprint]{article}",
    "\\usepackage{natbib}",
    "\\title{DISSTANCE: A Dataset for Title-Level Similarity and Stance Relations in Disinformation Detection}",
    "\\author{Mohammed El Amine Mokhtari\\\\",
    "University of Mons (UMONS)\\\\",
    "ISIA Lab}",
    "\\begin{document}",
    "\\maketitle",
    "\\section{References}",
    "\\bibliography{refs}",
    "\\begin{abstract}",
    "We present DISSTANCE.",
    "\\end{abstract}",
    "\\section{Introduction}",
    "Intro text with \\citep{smith2020}.",
    "\\end{document}",
  ].join("\n");
}

function buildHealthyDistanceFixture(): string {
  return [
    "\\documentclass[preprint]{article}",
    "\\usepackage{natbib}",
    "\\title{DISSTANCE}",
    "\\author{Mohammed El Amine Mokhtari\\\\UMONS}",
    "\\begin{document}",
    "\\maketitle",
    "\\begin{abstract}",
    "We present DISSTANCE.",
    "\\end{abstract}",
    "\\section{Introduction}",
    "Intro text.",
    "\\bibliography{refs}",
    "\\end{document}",
  ].join("\n");
}

describe("detectReferencesRecoveryIntent", () => {
  it("detects fix-references phrasing without paper-specific strings", () => {
    expect(detectReferencesRecoveryIntent("fix the references")).toBe(true);
    expect(detectReferencesRecoveryIntent("put references back at the end")).toBe(true);
    expect(detectReferencesRecoveryIntent("fix it")).toBe(true);
    expect(detectReferencesRecoveryIntent("Find the error that stopping the compiler")).toBe(false);
  });
});

describe("bibliography relocation recovery", () => {
  const damaged = buildDamagedDistanceFixture();

  it("detects misplaced references after maketitle and before abstract", () => {
    const site = getMisplacedBibliographySite(damaged);
    expect(site).toEqual({ startLine: 9, endLine: 10 });
    expect(validateBibliographyStructure(damaged).ok).toBe(false);
  });

  it("builds a relocation plan that moves references to the end", () => {
    const plan = buildBibliographyRelocationPlan("main.tex", damaged);
    expect(plan).not.toBeNull();
    if (!plan) return;

    expect(plan.removeOnly).toBe(false);
    expect(plan.removeStart).toBe(9);
    expect(validateBibliographyStructure(plan.previewContent).ok).toBe(true);
    expect(plan.previewContent).toMatch(/\\section\{Introduction\}[\s\S]*\\section\{References\}/);
    expect(plan.previewContent).toMatch(/\\bibliography\{refs\}[\s\S]*\\end\{document\}/);
    expect(plan.previewContent).not.toMatch(
      /\\maketitle[\s\S]*\\section\{References\}[\s\S]*\\begin\{abstract\}/
    );
  });

  it("returns relocation actions for compile-fix on damaged manuscripts", () => {
    const recovery = tryBibliographyRecovery({
      file: "main.tex",
      content: damaged,
      compileFixRequest: true,
      userMessage: "Find the error that stopping the compiler",
    });
    expect(recovery).not.toBeNull();
    if (!recovery) return;

    expect(recovery.actions.length).toBe(1);
    expect(recovery.actions[0]?.type).toBe("replace_lines");
    expect(recovery.message).toMatch(/Moved the references block/i);
    expect(recovery.message).toMatch(/Recompile to verify/i);
    expect(recovery.message).not.toMatch(/issue is fixed/i);
  });

  it("returns relocation for fix-the-references requests on damaged manuscripts", () => {
    const recovery = tryBibliographyRecovery({
      file: "main.tex",
      content: damaged,
      compileFixRequest: false,
      userMessage: "fix the references",
    });
    expect(recovery?.actions.length).toBeGreaterThan(0);
  });

  it("no-ops on healthy manuscripts", () => {
    const healthy = buildHealthyDistanceFixture();
    expect(tryBibliographyRecovery({
      file: "main.tex",
      content: healthy,
      compileFixRequest: true,
      userMessage: "fix compile errors",
    })).toBeNull();
  });

  it("still rejects inserting references at the top on healthy manuscripts", () => {
    const healthy = buildHealthyDistanceFixture();
    const preview = healthy.replace(
      "\\maketitle",
      "\\maketitle\n\\section{References}\n\\bibliography{refs}"
    );
    const result = validateCompileFixEdit({
      content: healthy,
      startLine: 6,
      endLine: 6,
      replace: "\\maketitle\n\\section{References}\n\\bibliography{refs}",
      previewContent: preview,
    });
    expect(result.ok).toBe(false);
  });

  it("relocation actions produce valid compile-fix previews", () => {
    const plan = buildBibliographyRelocationPlan("main.tex", damaged);
    expect(plan).not.toBeNull();
    if (!plan) return;

    const actions = buildBibliographyRelocationActions(plan, damaged);
    expect(actions).toHaveLength(1);
    const action = actions[0];
    expect(action?.type).toBe("replace_lines");
    if (action?.type !== "replace_lines") return;

    const lines = damaged.split("\n");
    const previewContent = [
      ...lines.slice(0, action.startLine - 1),
      ...action.replace.split("\n"),
      ...lines.slice(action.endLine),
    ].join("\n");

    const check = validateCompileFixEdit({
      content: damaged,
      startLine: action.startLine,
      endLine: action.endLine,
      replace: action.replace,
      previewContent,
    });
    expect(check.ok).toBe(true);
    expect(validateBibliographyStructure(previewContent).ok).toBe(true);
  });
});
