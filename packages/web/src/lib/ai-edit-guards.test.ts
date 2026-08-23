import { describe, expect, it } from "vitest";
import {
  countIdenticalNonCommentLines,
  parseLineMacro,
  validateNoSiblingCommandStacking,
} from "./ai-edit-guards";

describe("parseLineMacro", () => {
  it("parses braced LaTeX macros", () => {
    expect(parseLineMacro("\\textit{University} \\\\")).toEqual({
      macro: "textit",
      content: "University",
      trimmedLine: "\\textit{University} \\\\",
    });
    expect(parseLineMacro("\\title{My Paper}")).toEqual({
      macro: "title",
      content: "My Paper",
      trimmedLine: "\\title{My Paper}",
    });
    expect(parseLineMacro("\\foo{bar}")).toEqual({
      macro: "foo",
      content: "bar",
      trimmedLine: "\\foo{bar}",
    });
  });

  it("returns null for non-macro lines", () => {
    expect(parseLineMacro("City, Country \\\\")).toBeNull();
    expect(parseLineMacro("% comment")).toBeNull();
  });
});

describe("countIdenticalNonCommentLines", () => {
  it("counts duplicate non-comment lines", () => {
    const block = "\\textit{University} \\\\ \n\n\\textit{University} \\\\ ";
    expect(countIdenticalNonCommentLines(block, "\\textit{University} \\\\")).toBe(2);
    expect(countIdenticalNonCommentLines(block, "\\and")).toBe(0);
  });
});

describe("validateNoSiblingCommandStacking", () => {
  const duplicateMacroBlock = [
    "\\textit{University} \\\\",
    "",
    "\\textit{University} \\\\",
  ].join("\n");

  it("rejects stacking a new macro line below an unchanged duplicate (University/UMONS fixture)", () => {
    const preview = [
      "\\textit{University} \\\\",
      "\\textit{UMONS} \\\\",
      "\\textit{University} \\\\",
    ].join("\n");

    const result = validateNoSiblingCommandStacking(duplicateMacroBlock, preview);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("stack");
      expect(result.reason).toContain("in place");
      expect(result.reason).not.toContain("University");
      expect(result.reason).not.toContain("UMONS");
    }
  });

  it("accepts in-place replace on the line that held the old value", () => {
    const preview = [
      "\\textit{UMONS} \\\\",
      "",
      "\\textit{University} \\\\",
    ].join("\n");

    expect(validateNoSiblingCommandStacking(duplicateMacroBlock, preview)).toEqual({ ok: true });
  });

  it("rejects stacking \\title{...} below an unchanged duplicate \\title{...}", () => {
    const original = [
      "\\documentclass{article}",
      "\\title{Placeholder Title}",
      "\\title{Placeholder Title}",
      "\\begin{document}",
    ].join("\n");
    const preview = [
      "\\documentclass{article}",
      "\\title{Placeholder Title}",
      "\\title{Real Title}",
      "\\begin{document}",
    ].join("\n");

    const result = validateNoSiblingCommandStacking(original, preview);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("\\title");
    }
  });

  it("accepts in-place \\title replace", () => {
    const original = "\\title{Old Title}\n\\begin{document}";
    const preview = "\\title{New Title}\n\\begin{document}";
    expect(validateNoSiblingCommandStacking(original, preview)).toEqual({ ok: true });
  });

  it("rejects stacking \\foo{...} below unchanged duplicate \\foo{...}", () => {
    const original = "\\foo{placeholder}\n\\foo{placeholder}\n\\end{document}";
    const preview = "\\foo{placeholder}\n\\foo{new-value}\n\\end{document}";
    const result = validateNoSiblingCommandStacking(original, preview);
    expect(result.ok).toBe(false);
  });

  it("allows adding a same-macro line below a unique unchanged line (add intent)", () => {
    const original = "\\textit{MIT} \\\\ \n\n\\end{document}";
    const preview = "\\textit{MIT} \\\\ \n\\textit{Also Google} \\\\ \n\\end{document}";
    expect(validateNoSiblingCommandStacking(original, preview)).toEqual({ ok: true });
  });

  it("allows unrelated consecutive macros with different names", () => {
    const original = "\\author{Alice}\n\\date{today}";
    const preview = "\\author{Alice}\n\\date{tomorrow}";
    expect(validateNoSiblingCommandStacking(original, preview)).toEqual({ ok: true });
  });

  it("allows compile-fix style line repair without stacking siblings", () => {
    const original = "\\documentclass{article}\n\\usepackage\n\\begin{document}";
    const preview = "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}";
    expect(validateNoSiblingCommandStacking(original, preview)).toEqual({ ok: true });
  });
});
