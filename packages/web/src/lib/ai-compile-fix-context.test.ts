import { describe, expect, it } from "vitest";
import {
  AI_COMPILE_FIX_CONTEXT_CHAR_LIMIT,
  buildAiCompileFixContext,
  extractLineSnippet,
  formatCompileErrorLines,
  parseFileLineFromMessage,
} from "./ai-compile-fix-context";

const sampleTex = `\\documentclass{article}
\\begin{document}
\\section{Intro}
First line
\\textbf{broken
\\section{Methods}
More content
\\end{document}`;

describe("formatCompileErrorLines", () => {
  it("formats structured compile errors", () => {
    expect(
      formatCompileErrorLines([
        { message: "Missing } inserted", file: "main.tex", line: 5 },
        { message: "Undefined control sequence" },
      ])
    ).toBe("main.tex:5: Missing } inserted\nUndefined control sequence");
  });
});

describe("parseFileLineFromMessage", () => {
  it("parses file:line from error text", () => {
    expect(parseFileLineFromMessage("main.tex:42: Undefined control sequence")).toEqual({
      file: "main.tex",
      line: 42,
    });
    expect(parseFileLineFromMessage("on input line 17.")).toBeNull();
  });
});

describe("extractLineSnippet", () => {
  it("returns a window around the cited line", () => {
    const snippet = extractLineSnippet(sampleTex, 5, 1);
    expect(snippet).toContain("> 5:");
    expect(snippet).toContain("\\textbf{broken");
    expect(snippet).toContain("4:");
    expect(snippet).toContain("6:");
  });
});

describe("buildAiCompileFixContext", () => {
  it("includes error strings and snippets around cited locations", () => {
    const result = buildAiCompileFixContext({
      errors: [{ message: "Missing } inserted", file: "main.tex", line: 5 }],
      files: [{ path: "main.tex", content: sampleTex }],
      activeFile: "main.tex",
    });

    expect(result).toContain("Compile errors:");
    expect(result).toContain("main.tex:5: Missing } inserted");
    expect(result).toContain("around line 5");
    expect(result).toContain("\\textbf{broken");
    expect(result.length).toBeLessThanOrEqual(AI_COMPILE_FIX_CONTEXT_CHAR_LIMIT + 200);
  });

  it("falls back to trimmed active file when errors have no line numbers", () => {
    const deadPaste = "\\end{document}\n" + "Z".repeat(10_000);
    const result = buildAiCompileFixContext({
      errors: [{ message: "Compilation failed — see log for details" }],
      files: [{ path: "main.tex", content: sampleTex + deadPaste }],
      activeFile: "main.tex",
    });

    expect(result).toContain("Compile errors:");
    expect(result).toContain("--- main.tex ---");
    expect(result).toContain("\\section{Intro}");
    expect(result).not.toContain("ZZZZ");
  });

  it("supports errors-only retry mode", () => {
    const result = buildAiCompileFixContext({
      errors: [{ message: "Missing } inserted", file: "main.tex", line: 5 }],
      files: [{ path: "main.tex", content: sampleTex }],
      errorsOnly: true,
    });

    expect(result).toBe("Compile errors:\nmain.tex:5: Missing } inserted");
    expect(result).not.toContain("around line");
  });

  it("respects the overall char cap", () => {
    const hugeTex = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join("\n");
    const result = buildAiCompileFixContext({
      errors: [
        { message: "Error A", file: "main.tex", line: 10 },
        { message: "Error B", file: "main.tex", line: 150 },
      ],
      files: [{ path: "main.tex", content: hugeTex }],
      charLimit: 500,
    });

    expect(result.length).toBeLessThanOrEqual(520);
    expect(result).toContain("Compile errors:");
  });
});
