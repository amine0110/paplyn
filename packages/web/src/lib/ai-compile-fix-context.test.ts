import { describe, expect, it } from "vitest";
import {
  buildAiCompileFixContext,
  extractLineSnippet,
  formatCompileErrorLines,
  parseFileLineFromMessage,
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
