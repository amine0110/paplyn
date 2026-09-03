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

  it("detects references-at-the-beginning phrasing (live 0.5.33 user message)", () => {
    const message =
      "the references are put at the beginning of the paper, can you fix this";
    expect(detectReferencesRecoveryIntent(message)).toBe(true);
  });

  it("detects PAP-48 live user phrases (why-questions and follow-ups)", () => {
    expect(
      detectReferencesRecoveryIntent(
        "why does the references section is at the beginning of the article"
      )
    ).toBe(true);
    expect(detectReferencesRecoveryIntent("the references are at the beginning")).toBe(true);
    expect(detectReferencesRecoveryIntent("can you fix this")).toBe(true);
    expect(detectReferencesRecoveryIntent("do the fix and recompile after that")).toBe(true);
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
      texFiles: new Map([["main.tex", damaged]]),
      mainFile: "main.tex",
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
      texFiles: new Map([["main.tex", damaged]]),
      mainFile: "main.tex",
      compileFixRequest: false,
      userMessage: "fix the references",
    });
    expect(recovery?.actions.length).toBeGreaterThan(0);
  });

  it("no-ops on healthy manuscripts", () => {
    const healthy = buildHealthyDistanceFixture();
    expect(tryBibliographyRecovery({
      texFiles: new Map([["main.tex", healthy]]),
      mainFile: "main.tex",
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

function buildTemplateInputFixture(): { mainTex: string; templateTex: string } {
  const templateTex = [
    "\\section{References}",
    "\\bibliography{refs}",
    "\\section{Introduction}",
    "We present DISSTANCE.",
    "\\section{Methods}",
    "Methods text with \\citep{smith2020}.",
  ].join("\n");

  const mainTex = [
    "\\documentclass[preprint]{article}",
    "\\usepackage{natbib}",
    "\\begin{document}",
    "\\input{template}",
    "\\end{document}",
  ].join("\n");

  return { mainTex, templateTex };
}

describe("included-file bibliography recovery (PAP-47)", () => {
  const AMINE_MESSAGE =
    "the references are put at the beginning of the paper, can you fix this";

  it("relocates misplaced references in template.tex when main only inputs it", () => {
    const { mainTex, templateTex } = buildTemplateInputFixture();
    const recovery = tryBibliographyRecovery({
      texFiles: new Map([
        ["main.tex", mainTex],
        ["template.tex", templateTex],
      ]),
      mainFile: "main.tex",
      compileFixRequest: false,
      userMessage: AMINE_MESSAGE,
    });

    expect(recovery).not.toBeNull();
    if (!recovery) return;

    expect(recovery.file).toBe("template.tex");
    expect(recovery.actions).toHaveLength(1);
    expect(recovery.actions[0]?.type).toBe("replace_lines");
    expect(recovery.actions[0]?.file).toBe("template.tex");
    expect(recovery.message).toMatch(/Moved the references block/i);
    expect(validateBibliographyStructure(recovery.previewContent).ok).toBe(true);
    expect(recovery.previewContent).toMatch(
      /\\section\{Introduction\}[\s\S]*\\section\{References\}[\s\S]*\\bibliography\{refs\}/
    );
    expect(recovery.previewContent).not.toMatch(
      /\\section\{References\}[\s\S]*\\section\{Introduction\}/
    );
  });

  it("matches the live user message for recovery intent", () => {
    expect(detectReferencesRecoveryIntent(AMINE_MESSAGE)).toBe(true);
  });
});

function buildDuplicateBibliographyTemplateFixture(): string {
  return [
    "\\documentclass{article}",
    "\\usepackage{natbib}",
    "\\title{Example}",
    "\\author{Author}",
    "\\begin{document}",
    "\\maketitle",
    "\\bibliographystyle{plainnat}",
    "\\bibliography{references}",
    "\\begin{abstract}",
    "Abstract text.",
    "\\end{abstract}",
    "\\section{Introduction}",
    "Body text.",
    "\\FloatBarrier",
    "\\bibliographystyle{plainnat}",
    "\\bibliography{references}",
    "\\end{document}",
  ].join("\n");
}

describe("PAP-48 bibliography recovery short-circuit", () => {
  const duplicateTemplate = buildDuplicateBibliographyTemplateFixture();

  it("short-circuits on why-question when duplicate bibliography is at top", () => {
    const recovery = tryBibliographyRecovery({
      texFiles: new Map([["template.tex", duplicateTemplate]]),
      mainFile: "template.tex",
      compileFixRequest: false,
      userMessage: "why does the references section is at the beginning of the article",
    });
    expect(recovery).not.toBeNull();
    expect(recovery?.actions[0]?.type).toBe("replace_lines");
    expect(recovery?.message).toMatch(/duplicate references|Removed/i);
    expect(validateBibliographyStructure(recovery?.previewContent ?? "").ok).toBe(true);
  });

  it("short-circuits on 'the references are at the beginning'", () => {
    const recovery = tryBibliographyRecovery({
      texFiles: new Map([["template.tex", duplicateTemplate]]),
      mainFile: "template.tex",
      compileFixRequest: false,
      userMessage: "the references are at the beginning",
    });
    expect(recovery?.actions.length).toBeGreaterThan(0);
  });

  it("short-circuits on 'can you fix this' when bibliography is misplaced", () => {
    const recovery = tryBibliographyRecovery({
      texFiles: new Map([["template.tex", duplicateTemplate]]),
      mainFile: "template.tex",
      compileFixRequest: false,
      userMessage: "can you fix this",
    });
    expect(recovery?.actions.length).toBeGreaterThan(0);
  });

  it("short-circuits on 'do the fix and recompile after that'", () => {
    const recovery = tryBibliographyRecovery({
      texFiles: new Map([["template.tex", duplicateTemplate]]),
      mainFile: "template.tex",
      compileFixRequest: false,
      userMessage: "do the fix and recompile after that",
    });
    expect(recovery?.actions.length).toBeGreaterThan(0);
    expect(recovery?.message).toMatch(/Recompile/i);
  });
});
