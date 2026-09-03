import { describe, expect, it } from "vitest";
import { validateClientAction } from "./ai-client-actions";
import {
  buildBodyContentInsertPlan,
  containsBodyManuscriptContent,
  detectInsertAnchorIntent,
  findMisplacedBodyBlock,
  resolveBodyContentInsertLine,
  validateDocumentClassPreserved,
  validateManuscriptStructureEdit,
  validateNoDestructivePreambleReplace,
} from "./ai-manuscript-guards";
import {
  buildMisplacedBodyRecoveryPlan,
  detectMisplacedBodyRecoveryIntent,
  tryMisplacedBodyRecovery,
} from "./ai-manuscript-body-recovery";

const TABLE_BLOCK = [
  "\\begin{table}[h]",
  "\\centering",
  "\\begin{tabular}{lcc}",
  "A & B & C \\\\",
  "\\hline",
  "1 & 2 & 3",
  "\\end{tabular}",
  "\\caption{Results}",
  "\\label{tab:results}",
  "\\end{table}",
].join("\n");

function buildManuscriptTemplate(): string {
  return [
    "\\documentclass[conference]{IEEEtran}",
    "\\usepackage{booktabs}",
    "\\usepackage{amsmath}",
    "\\title{DisStance}",
    "\\author{",
    "  \\IEEEauthorblockN{Author}",
    "  \\IEEEauthorblockA{\\textit{ISIA Lab} \\\\",
    "  University}",
    "}",
    "\\date{}",
    "\\begin{document}",
    "\\maketitle",
    "\\begin{abstract}",
    "Retrieval is a core step in disinformation detection.",
    "\\end{abstract}",
    "\\begin{IEEEkeywords}",
    "keyword one, keyword two",
    "\\end{IEEEkeywords}",
    "\\section{Introduction}",
    "We introduce our approach.",
    "\\end{document}",
  ].join("\n");
}

describe("containsBodyManuscriptContent", () => {
  it("detects tabular and table environments", () => {
    expect(containsBodyManuscriptContent(TABLE_BLOCK)).toBe(true);
    expect(containsBodyManuscriptContent("\\begin{tabular}{cc}")).toBe(true);
    expect(containsBodyManuscriptContent("\\section{Introduction}")).toBe(true);
    expect(containsBodyManuscriptContent("\\usepackage{booktabs}")).toBe(false);
  });
});

describe("insert anchor resolution (PAP-50)", () => {
  const content = buildManuscriptTemplate();

  it("resolves between abstract and intro before Introduction section", () => {
    expect(detectInsertAnchorIntent("put it between abstract and intro")).toBe(
      "before_introduction"
    );
    const line = resolveBodyContentInsertLine(content, "before_introduction");
    expect(content.split("\n")[line! - 1]).toContain("\\section{Introduction}");
  });

  it("buildBodyContentInsertPlan inserts after abstract by default", () => {
    const plan = buildBodyContentInsertPlan(content, TABLE_BLOCK);
    expect(plan).not.toBeNull();
    const lines = content.split("\n");
    const abstractEnd = lines.findIndex((l) => l.includes("\\end{abstract}")) + 1;
    expect(plan!.startLine).toBeGreaterThanOrEqual(abstractEnd);
  });

  it("buildBodyContentInsertPlan honors between abstract and intro", () => {
    const plan = buildBodyContentInsertPlan(
      content,
      TABLE_BLOCK,
      "insert between abstract and intro"
    );
    expect(plan).not.toBeNull();
    expect(plan!.replace).toContain("\\begin{table}");
    const introLine = linesIndexOfSection(content, "Introduction");
    expect(plan!.startLine).toBe(introLine);
  });
});

function linesIndexOfSection(content: string, title: string): number {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]?.includes(`\\section{${title}}`)) return i + 1;
  }
  return -1;
}

describe("validateDocumentClassPreserved", () => {
  it("rejects when \\documentclass is removed", () => {
    const original = buildManuscriptTemplate();
    const broken = [
      "",
      "  ISIA Lab \\\\",
      "}",
      "",
      "\\date{}",
      "\\begin{document}",
    ].join("\n");
    const result = validateDocumentClassPreserved(original, broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("\\documentclass");
    }
  });
});

describe("validateNoDestructivePreambleReplace", () => {
  it("rejects replace_lines 1-26 that drops \\documentclass while moving a table", () => {
    const content = buildManuscriptTemplate();
    const misplaced = `${TABLE_BLOCK}\n${content}`;
    const smashed = [
      "",
      "  ISIA Lab \\\\",
      "}",
      "",
      "\\date{}",
      "\\begin{document}",
    ].join("\n");

    const preview = smashed;
    const result = validateNoDestructivePreambleReplace(
      misplaced,
      1,
      26,
      smashed,
      preview
    );
    expect(result.ok).toBe(false);
  });
});

describe("validateClientAction insert_at_cursor (PAP-50)", () => {
  it("relocates table insert at line 1 to after abstract", () => {
    const file = "template.tex";
    const content = buildManuscriptTemplate();
    const texFiles = new Map([[file, content]]);

    const result = validateClientAction(
      { type: "insert_at_cursor", text: TABLE_BLOCK },
      {
        texFiles,
        activeFile: file,
        hasSelection: false,
        cursorLine: 1,
        manuscriptGuards: true,
      }
    );

    expect("action" in result && result.action.type).toBe("replace_lines");
    if ("action" in result && result.action.type === "replace_lines") {
      expect(result.action.replace).toContain("\\begin{table}");
      expect(result.action.file).toBe(file);
    }
  });

  it("rejects replace_lines that remove \\documentclass", () => {
    const file = "template.tex";
    const content = buildManuscriptTemplate();
    const texFiles = new Map([[file, content]]);
    const smashed = [
      "",
      "  ISIA Lab \\\\",
      "}",
      "\\date{}",
      "\\begin{document}",
    ].join("\n");

    const result = validateClientAction(
      {
        type: "replace_lines",
        file,
        startLine: 1,
        endLine: 26,
        replace: smashed,
      },
      { texFiles, hasSelection: false, manuscriptGuards: true }
    );

    expect("rejected" in result && result.rejected).toBe(true);
    if ("rejected" in result && result.rejected) {
      expect(result.reason).toMatch(/documentclass|preamble/i);
    }
  });
});

describe("misplaced body recovery", () => {
  it("finds table block before \\documentclass", () => {
    const content = `${TABLE_BLOCK}\n${buildManuscriptTemplate()}`;
    const range = findMisplacedBodyBlock(content);
    expect(range).not.toBeNull();
    expect(range!.blockLines.join("\n")).toContain("\\begin{table}");
  });

  it("builds recovery plan that preserves preamble", () => {
    const file = "template.tex";
    const content = `${TABLE_BLOCK}\n${buildManuscriptTemplate()}`;
    const plan = buildMisplacedBodyRecoveryPlan(
      file,
      content,
      "put it between abstract and intro"
    );
    expect(plan).not.toBeNull();
    expect(plan!.previewContent).toContain("\\documentclass");
    expect(plan!.previewContent).toContain("\\begin{table}");
    expect(plan!.previewContent.indexOf("\\documentclass")).toBeLessThan(
      plan!.previewContent.indexOf("\\begin{table}")
    );
  });

  it("tryMisplacedBodyRecovery runs on user correction message", () => {
    const file = "template.tex";
    const content = `${TABLE_BLOCK}\n${buildManuscriptTemplate()}`;
    const texFiles = new Map([[file, content]]);

    const recovery = tryMisplacedBodyRecovery({
      texFiles,
      mainFile: file,
      userMessage: "put it between abstract and intro",
      activeFile: file,
    });

    expect(recovery).not.toBeNull();
    expect(recovery!.actions.length).toBeGreaterThan(0);
    expect(detectMisplacedBodyRecoveryIntent("you inserted it before document init")).toBe(true);
  });

  it("reports missing preamble when \\documentclass was already destroyed", () => {
    const file = "template.tex";
    const broken = [
      TABLE_BLOCK,
      "",
      "  ISIA Lab \\\\",
      "}",
      "\\date{}",
      "\\begin{document}",
      "\\maketitle",
      "\\begin{abstract}",
      "Text",
      "\\end{abstract}",
      "\\section{Introduction}",
      "\\end{document}",
    ].join("\n");
    const plan = buildMisplacedBodyRecoveryPlan(file, broken);
    expect(plan).not.toBeNull();
    expect(plan!.preambleMissing).toBe(true);
  });
});

describe("validateManuscriptStructureEdit", () => {
  it("rejects body content before documentclass in preview", () => {
    const original = buildManuscriptTemplate();
    const preview = `${TABLE_BLOCK}\n${original}`;
    const result = validateManuscriptStructureEdit({
      originalContent: original,
      previewContent: preview,
      replace: TABLE_BLOCK,
    });
    expect(result.ok).toBe(false);
  });
});
