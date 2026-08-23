import { describe, expect, it } from "vitest";
import {
  countBeginDocumentInFirstCopy,
  countDocumentClassLinesBeforeBeginDocument,
  formatCompileFixLineChangeSummary,
  getDocumentClassLine,
  getFirstLaTeXCopyEndLine,
  getFirstNonCommentLine,
  validateCompileFixEdit,
  validateLaTeXPreambleOrder,
  validateNoDuplicateBeginDocument,
  validateNoDuplicateDocumentClass,
  validateNoInventedPackages,
} from "./ai-compile-fix-validation";

const smashedLine1 =
  "\\usepackage  \\title{Your Paper Title Here\\documentclass[conference]{IEEEtran}";

const concatenatedIeee = [
  smashedLine1,
  "\\usepackage{amsmath}",
  "\\begin{document}",
  "Hello",
  "\\end{document}",
  "",
  "\\documentclass[conference]{IEEEtran}",
  "\\usepackage{graphicx}",
  "\\begin{document}",
  "Duplicate copy",
  "\\end{document}",
].join("\n");

describe("getFirstNonCommentLine", () => {
  it("skips comments and blank lines", () => {
    expect(getFirstNonCommentLine("% comment\n\n\\documentclass{article}")).toEqual({
      line: 3,
      text: "\\documentclass{article}",
    });
  });
});

describe("getFirstLaTeXCopyEndLine", () => {
  it("ends at first \\end{document}", () => {
    expect(getFirstLaTeXCopyEndLine(concatenatedIeee)).toBe(5);
  });

  it("ends before a second \\documentclass when no \\end{document}", () => {
    const content = "\\documentclass{article}\n\\begin{document}\nHi\n\\documentclass{book}\n";
    expect(getFirstLaTeXCopyEndLine(content)).toBe(3);
  });
});

describe("validateLaTeXPreambleOrder", () => {
  it("accepts documentclass as first line", () => {
    expect(validateLaTeXPreambleOrder("\\documentclass{article}\n\\usepackage{amsmath}")).toEqual({
      ok: true,
    });
  });

  it("rejects usepackage before documentclass (smashed preamble)", () => {
    const result = validateLaTeXPreambleOrder(smashedLine1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("before \\documentclass");
      expect(result.reason).toContain("do not prepend");
    }
  });
});

describe("validateNoInventedPackages", () => {
  it("allows fixing a bare \\usepackage line", () => {
    expect(
      validateNoInventedPackages(["\\usepackage  "], "\\usepackage{amsmath}")
    ).toEqual({ ok: true });
  });

  it("rejects inventing cite on a non-package line", () => {
    const result = validateNoInventedPackages(
      ["\\section{Intro}"],
      "\\section{Intro}\\usepackage{cite}"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("cite");
      expect(result.reason).toContain("do not invent");
    }
  });
});

describe("validateNoDuplicateDocumentClass", () => {
  it("rejects two documentclass lines in the first copy", () => {
    const content = [
      "\\documentclass[conference]{IEEEtran}",
      "\\documentclass[conference]{IEEEtran}",
      "\\begin{document}",
      "\\end{document}",
    ].join("\n");
    expect(countDocumentClassLinesBeforeBeginDocument(content)).toBe(2);
    const result = validateNoDuplicateDocumentClass(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("2 \\documentclass");
    }
  });
});

describe("validateNoDuplicateBeginDocument", () => {
  it("rejects a second begin{document} in the first copy", () => {
    const content = [
      "\\documentclass[conference]{IEEEtran}",
      "\\begin{document}",
      "\\begin{document}",
      "\\maketitle",
      "\\end{document}",
    ].join("\n");
    expect(countBeginDocumentInFirstCopy(content)).toBe(2);
    const result = validateNoDuplicateBeginDocument(content);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("2 \\begin{document}");
    }
  });

  it("rejects compile-fix edit that prepends begin{document} before maketitle", () => {
    const content = [
      "\\documentclass[conference]{IEEEtran}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "\\maketitle",
      "\\end{document}",
    ].join("\n");
    const preview = [
      "\\documentclass[conference]{IEEEtran}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "\\begin{document}",
      "\\maketitle",
      "\\end{document}",
    ].join("\n");

    const result = validateCompileFixEdit({
      content,
      startLine: 4,
      endLine: 4,
      replace: "\\begin{document}\n\\maketitle",
      previewContent: preview,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("\\begin{document}");
    }
  });
});

describe("validateCompileFixEdit", () => {
  it("rejects edits past the first document copy", () => {
    const result = validateCompileFixEdit({
      content: concatenatedIeee,
      startLine: 8,
      endLine: 8,
      replace: "\\usepackage{graphicx}",
      previewContent: concatenatedIeee.replace("\\usepackage{graphicx}", "\\usepackage{amssymb}"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("first document copy");
    }
  });

  it("rejects smashed line 1 replacement", () => {
    const preview = smashedLine1;
    const result = validateCompileFixEdit({
      content: concatenatedIeee,
      startLine: 1,
      endLine: 1,
      replace: preview,
      previewContent: [preview, ...concatenatedIeee.split("\n").slice(1)].join("\n"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("before \\documentclass");
    }
  });

  it("accepts repairing bare usepackage on cited line in first copy", () => {
    const content = "\\documentclass{article}\n\\usepackage\n\\begin{document}\n";
    const preview = "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n";
    expect(
      validateCompileFixEdit({
        content,
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{amsmath}",
        previewContent: preview,
      })
    ).toEqual({ ok: true });
  });
});

describe("getDocumentClassLine", () => {
  it("finds the first documentclass line", () => {
    expect(getDocumentClassLine(concatenatedIeee)).toBe(1);
    expect(getDocumentClassLine("\\usepackage{x}\n\\documentclass{article}")).toBe(2);
  });
});

describe("formatCompileFixLineChangeSummary", () => {
  it("formats single and multi-line ranges", () => {
    expect(
      formatCompileFixLineChangeSummary({ file: "main.tex", startLine: 3, endLine: 3 })
    ).toBe("Changed main.tex line 3.");
    expect(
      formatCompileFixLineChangeSummary({ file: "main.tex", startLine: 3, endLine: 5 })
    ).toBe("Changed main.tex lines 3–5.");
  });
});
