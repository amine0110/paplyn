import { describe, expect, it } from "vitest";
import {
  buildAiCompileFixContext,
  buildCompileFixTargetHint,
  buildCompileFixMultiErrorHint,
  buildGetFileWindow,
  extractLineSnippet,
  formatCompileErrorLines,
  getPrimaryCompileErrorLocation,
  normalizeAiCompileErrors,
  parseFileLineFromMessage,
  resolveCompileErrorLocation,
  selectCompileFixMessages,
} from "./ai-compile-fix-context";

const sampleTex = `\\documentclass{article}
\\begin{document}
\\section{Intro}
First line
\\textbf{broken
\\section{Methods}
More content
\\end{document}`;

describe("normalizeAiCompileErrors", () => {
  it("truncates very long error messages", () => {
    const longMessage = "E".repeat(500);
    const normalized = normalizeAiCompileErrors([{ message: longMessage }]);

    expect(normalized[0]?.message.length).toBe(401);
    expect(normalized[0]?.message.endsWith("…")).toBe(true);
    expect(normalized[0]?.message.startsWith("E".repeat(400))).toBe(true);
  });

  it("preserves short messages and structured fields", () => {
    expect(
      normalizeAiCompileErrors([
        { message: "Missing } inserted", file: "main.tex", line: 5 },
      ])
    ).toEqual([{ message: "Missing } inserted", file: "main.tex", line: 5 }]);
  });

  it("drops warnings when errors are present", () => {
    expect(
      normalizeAiCompileErrors([
        { message: "Fatal error", severity: "error", file: "main.tex", line: 1 },
        { message: "Overfull hbox", severity: "warning", file: "main.tex", line: 2 },
      ])
    ).toEqual([{ message: "Fatal error", severity: "error", file: "main.tex", line: 1 }]);
  });

  it("caps the number of compile errors", () => {
    const errors = Array.from({ length: 30 }, (_, index) => ({
      message: `error ${index}`,
      severity: "error" as const,
    }));
    expect(normalizeAiCompileErrors(errors)).toHaveLength(25);
  });
});

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

describe("resolveCompileErrorLocation", () => {
  it("uses structured file and line when present", () => {
    expect(
      resolveCompileErrorLocation({
        message: "Missing } inserted",
        file: "main.tex",
        line: 12,
      })
    ).toEqual({ file: "main.tex", line: 12 });
  });

  it("parses file:line from message text", () => {
    expect(
      resolveCompileErrorLocation({
        message: "main.tex:42: Undefined control sequence",
      })
    ).toEqual({ file: "main.tex", line: 42 });
  });
});

describe("getPrimaryCompileErrorLocation", () => {
  it("returns the first error with a location", () => {
    expect(
      getPrimaryCompileErrorLocation([
        { message: "Generic failure" },
        { message: "main.tex:5: Missing bracket", file: "main.tex", line: 5 },
      ])
    ).toEqual({ file: "main.tex", line: 5 });
  });
});

describe("buildGetFileWindow", () => {
  it("centers a window around the cited line", () => {
    expect(buildGetFileWindow(12, 10)).toEqual({ startLine: 2, endLine: 22 });
    expect(buildGetFileWindow(3, 10)).toEqual({ startLine: 1, endLine: 13 });
  });
});

describe("buildCompileFixTargetHint", () => {
  it("instructs the model to read a small window first", () => {
    const hint = buildCompileFixTargetHint({ file: "main.tex", line: 12 });
    expect(hint).toContain("main.tex:12");
    expect(hint).toContain('get_file(path="main.tex", startLine=2, endLine=22)');
    expect(hint).toContain("FIRST tool call");
    expect(hint).toContain("FIRST document copy");
    expect(hint).toContain("Do not prepend");
  });
});

describe("buildCompileFixMultiErrorHint", () => {
  it("lists cited lines and bottom-up apply order", () => {
    const hint = buildCompileFixMultiErrorHint([
      { message: "error a", file: "main.tex", line: 3 },
      { message: "error b", file: "main.tex", line: 12 },
      { message: "error c", file: "main.tex", line: 7 },
    ]);
    expect(hint).toContain("main.tex lines 3, 7, 12");
    expect(hint).toContain("bottom up");
    expect(hint).toContain("main.tex:12, main.tex:7, main.tex:3");
  });

  it("returns undefined for a single error", () => {
    expect(
      buildCompileFixMultiErrorHint([{ message: "one", file: "main.tex", line: 2 }])
    ).toBeUndefined();
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
  it("includes error strings and project file paths only", () => {
    const result = buildAiCompileFixContext({
      errors: [{ message: "Missing } inserted", file: "main.tex", line: 5 }],
      files: [
        { path: "main.tex", content: sampleTex },
        { path: "sections/intro.tex", content: "\\section{Intro}" },
      ],
      activeFile: "main.tex",
    });

    expect(result).toContain("Compile errors:");
    expect(result).toContain("main.tex:5: Missing } inserted");
    expect(result).toContain("Project .tex files:");
    expect(result).toContain("main.tex");
    expect(result).toContain("sections/intro.tex");
    expect(result).not.toContain("\\textbf{broken");
    expect(result).not.toContain("around line");
  });

  it("does not embed file bodies when errors have no line numbers", () => {
    const deadPaste = "\\end{document}\n" + "Z".repeat(10_000);
    const result = buildAiCompileFixContext({
      errors: [{ message: "Compilation failed — see log for details" }],
      files: [{ path: "main.tex", content: sampleTex + deadPaste }],
      activeFile: "main.tex",
    });

    expect(result).toContain("Compile errors:");
    expect(result).toContain("Project .tex files:");
    expect(result).toContain("main.tex");
    expect(result).not.toContain("\\section{Intro}");
    expect(result).not.toContain("ZZZZ");
  });

  it("supports errors-only retry mode", () => {
    const result = buildAiCompileFixContext({
      errors: [{ message: "Missing } inserted", file: "main.tex", line: 5 }],
      files: [{ path: "main.tex", content: sampleTex }],
      errorsOnly: true,
    });

    expect(result).toBe("Compile errors:\nmain.tex:5: Missing } inserted");
    expect(result).not.toContain("Project .tex files:");
  });
});

describe("selectCompileFixMessages", () => {
  it("keeps only the latest user message", () => {
    const messages = [
      { role: "user" as const, content: "old question" },
      {
        role: "assistant" as const,
        content: "The project context is too large for the AI service.",
      },
      { role: "user" as const, content: "Find the error that stopping the compiler" },
    ];

    expect(selectCompileFixMessages(messages)).toEqual([
      { role: "user", content: "Find the error that stopping the compiler" },
    ]);
  });

  it("ignores earlier turns entirely", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "Applied edit to main.tex." },
      { role: "user" as const, content: "fix the remaining errors" },
    ];

    expect(selectCompileFixMessages(messages)).toEqual([
      { role: "user", content: "fix the remaining errors" },
    ]);
  });
});
