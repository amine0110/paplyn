import { describe, expect, it } from "vitest";
import {
  buildAiCompileFixContext,
  buildCompileDiagnosticsContext,
  buildCompileFixTargetHint,
  buildCompileFixMultiErrorHint,
  buildCompileFixCiteCommandHint,
  buildGetFileWindow,
  COMPILE_FIX_GET_FILE_BEFORE_EDIT,
  COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET,
  COMPILE_FIX_MAX_STEPS,
  enrichCompileErrorsWithLocations,
  extractLineSnippet,
  formatCompileErrorLines,
  getCompileFixGetFileBudget,
  getPrimaryCompileErrorLocation,
  inferFirstCopyCompileFixLocation,
  isBrokenBeginDocumentLine,
  normalizeAiCompileErrors,
  normalizeAiCompileDiagnostics,
  parseFileLineFromMessage,
  prepareCompileErrorsForCompileFix,
  resolveCompileErrorLocation,
  resolveCompileFixSnippet,
  resolvePrimaryCompileErrorLocation,
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

describe("normalizeAiCompileDiagnostics", () => {
  it("keeps warnings alongside errors for review turns", () => {
    expect(
      normalizeAiCompileDiagnostics([
        { message: "Fatal error", severity: "error", file: "main.tex", line: 1 },
        { message: "Overfull hbox", severity: "warning", file: "main.tex", line: 2 },
      ])
    ).toEqual([
      { message: "Fatal error", severity: "error", file: "main.tex", line: 1 },
      { message: "Overfull hbox", severity: "warning", file: "main.tex", line: 2 },
    ]);
  });
});

describe("buildCompileDiagnosticsContext", () => {
  it("formats warnings and log excerpt", () => {
    const context = buildCompileDiagnosticsContext({
      errors: [{ message: "Overfull \\hbox", severity: "warning", file: "main.tex", line: 4 }],
      log: "This is pdfTeX\nOverfull \\hbox",
    });

    expect(context).toContain("Compile warnings:");
    expect(context).toContain("main.tex:4: Overfull \\hbox");
    expect(context).not.toContain("Compile log excerpt:");
  });

  it("includes log excerpt only when structured diagnostics are empty", () => {
    const context = buildCompileDiagnosticsContext({
      errors: [],
      log: "This is pdfTeX\nOutput written on main.pdf",
      includeRawLog: true,
    });
    expect(context).toContain("Compile log excerpt:");
    expect(context).toContain("This is pdfTeX");
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
  it("centers a window around the cited line and extends through line 30 for early errors", () => {
    expect(buildGetFileWindow(12, 10)).toEqual({ startLine: 2, endLine: 30 });
    expect(buildGetFileWindow(3, 10)).toEqual({ startLine: 1, endLine: 30 });
  });

  it("does not force line 30 minimum for errors deep in the file", () => {
    expect(buildGetFileWindow(100, 10)).toEqual({ startLine: 90, endLine: 110 });
  });
});

describe("buildCompileFixTargetHint", () => {
  it("steers edit-first when a cited error snippet is provided", () => {
    const snippet = extractLineSnippet(sampleTex, 5, 1);
    const hint = buildCompileFixTargetHint({ file: "main.tex", line: 5 }, { snippet });
    expect(hint).toContain("main.tex:5");
    expect(hint).toContain("already have the cited error location and snippet");
    expect(hint).toContain("replace_lines or apply_edit");
    expect(hint).toContain("do NOT call list_files or get_file");
    expect(hint).toContain(snippet);
    expect(hint).toContain(String(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET));
    expect(hint).not.toContain("FIRST tool call must be get_file");
  });

  it("instructs the model to read a small window when no snippet is available", () => {
    const hint = buildCompileFixTargetHint({ file: "main.tex", line: 12 });
    expect(hint).toContain("main.tex:12");
    expect(hint).toContain('get_file(path="main.tex", startLine=2, endLine=30)');
    expect(hint).toContain("FIRST tool call");
    expect(hint).toContain("FIRST document copy");
    expect(hint).toContain("Do not prepend");
    expect(hint).toContain("natbib");
    expect(hint).toContain(String(COMPILE_FIX_GET_FILE_BEFORE_EDIT));
  });
});

describe("getCompileFixGetFileBudget", () => {
  it("caps get_file to 1 when a cited snippet is injected", () => {
    expect(
      getCompileFixGetFileBudget({ hasCitedLocation: true, hasSnippet: true })
    ).toBe(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET);
    expect(COMPILE_FIX_MAX_GET_FILE_CALLS_WITH_SNIPPET).toBeLessThanOrEqual(1);
  });

  it("allows two reads when cited location exists without snippet", () => {
    expect(
      getCompileFixGetFileBudget({ hasCitedLocation: true, hasSnippet: false })
    ).toBe(COMPILE_FIX_GET_FILE_BEFORE_EDIT);
  });
});

describe("resolveCompileFixSnippet", () => {
  it("returns a line-numbered window from project files", () => {
    const texFiles = new Map([["main.tex", sampleTex]]);
    const snippet = resolveCompileFixSnippet({ file: "main.tex", line: 5 }, texFiles, 1);
    expect(snippet).toContain("> 5:");
    expect(snippet).toContain("\\textbf{broken");
  });
});

describe("COMPILE_FIX_MAX_STEPS", () => {
  it("keeps compile-fix turns short while PAP-38 handles multi-round retries", () => {
    expect(COMPILE_FIX_MAX_STEPS).toBe(6);
  });
});

describe("buildCompileFixCiteCommandHint", () => {
  it("guides a complete citep fix in one turn", () => {
    const hint = buildCompileFixCiteCommandHint([
      { message: "template.tex:64: Undefined control sequence. \\citep" },
    ]);
    expect(hint).toContain("\\citep");
    expect(hint).toContain("natbib");
    expect(hint).toMatch(/this turn/i);
  });

  it("returns undefined when error is unrelated", () => {
    expect(
      buildCompileFixCiteCommandHint([{ message: "Missing } inserted" }])
    ).toBeUndefined();
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

describe("inferFirstCopyCompileFixLocation", () => {
  it("targets broken \\begin{document in the first copy, not later duplicates", () => {
    const lines = [
      "",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath}",
      "\\usepackage{amsfonts}",
      "\\usepackage{amssymb}",
      "\\usepackage{algorithmic}",
      "\\usepackage{textcomp}",
      "\\begin{document",
      "\\title{Paper}",
    ];
    for (let copy = 1; copy < 4; copy += 1) {
      const offset = copy * 62;
      lines.push(`\\documentclass[conference]{IEEEtran}`);
      lines.push("\\begin{document}");
    }

    const content = lines.join("\n");
    expect(isBrokenBeginDocumentLine("\\begin{document")).toBe(true);
    expect(inferFirstCopyCompileFixLocation(content, "main.tex")).toEqual({
      file: "main.tex",
      line: 8,
    });
  });

  it("targets usepackage before documentclass in the first copy", () => {
    const content = [
      "",
      "\\usepackage{graphicx}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "\\end{document}",
      "\\documentclass[conference]{IEEEtran}",
    ].join("\n");

    expect(inferFirstCopyCompileFixLocation(content, "main.tex")).toEqual({
      file: "main.tex",
      line: 2,
    });
  });
});

describe("prepareCompileErrorsForCompileFix", () => {
  it("infers primary location when errors lack file/line and log is empty", () => {
    const content = [
      "",
      "\\usepackage{graphicx}",
      "\\begin{document",
      "\\title{Paper}",
      "\\documentclass[conference]{IEEEtran}",
    ].join("\n");

    const { errors, primaryLocation } = prepareCompileErrorsForCompileFix(
      [
        { message: "Compilation failed", severity: "error" },
        { message: "Another error", severity: "error" },
      ],
      { mainFile: "main.tex", mainFileContent: content }
    );

    expect(primaryLocation).toEqual({ file: "main.tex", line: 3 });
    expect(errors[0]?.file).toBe("main.tex");
    expect(errors[0]?.line).toBe(3);
  });

  it("enriches l.N patterns with main file path", () => {
    const enriched = enrichCompileErrorsWithLocations(
      [{ message: "! Missing $ inserted. l.8 <inserted text>", severity: "error" }],
      "main.tex"
    );
    expect(enriched[0]).toMatchObject({ file: "main.tex", line: 8 });
    expect(
      resolvePrimaryCompileErrorLocation(enriched, {
        mainFile: "main.tex",
        mainFileContent: "\\begin{document",
      })
    ).toEqual({ file: "main.tex", line: 8 });
  });
});
