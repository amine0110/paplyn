import { describe, expect, it } from "vitest";
import { formatToolProgressDone, formatToolProgressStart } from "./ai-tool-progress";

describe("formatToolProgressStart", () => {
  it("formats get_file with line range", () => {
    expect(
      formatToolProgressStart("get_file", {
        path: "main.tex",
        startLine: 2,
        endLine: 22,
      })
    ).toBe("Reading main.tex (lines 2–22)…");
  });

  it("formats replace_lines with single line", () => {
    expect(
      formatToolProgressStart("replace_lines", {
        file: "sections/intro.tex",
        startLine: 12,
        endLine: 12,
      })
    ).toBe("Replacing line 12 in intro.tex…");
  });
});

describe("formatToolProgressDone", () => {
  it("formats successful client actions", () => {
    expect(
      formatToolProgressDone("replace_lines", {
        kind: "client-action",
        action: {
          type: "replace_lines",
          file: "main.tex",
          startLine: 12,
          endLine: 12,
          replace: "\\usepackage{amsmath}",
          label: "Replaced line 12 in main.tex",
        },
      })
    ).toBe("Replaced line 12 in main.tex");
  });

  it("formats get_file reads", () => {
    expect(
      formatToolProgressDone("get_file", {
        path: "main.tex",
        content: "x",
        startLine: 2,
        endLine: 22,
        totalLines: 100,
        note: "",
        error: "",
      })
    ).toBe("Read main.tex (lines 2–22)");
  });
});
