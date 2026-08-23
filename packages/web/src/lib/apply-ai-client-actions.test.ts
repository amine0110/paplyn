import { describe, expect, it } from "vitest";
import { applyReplaceLinesToFileContent } from "./ai-client-actions";
import { applyAiClientActions, normalizeInsertAtCursorText } from "./apply-ai-client-actions";
import type { AiClientAction } from "./ai-client-actions";

describe("normalizeInsertAtCursorText", () => {
  it("adds a trailing newline when inserting a comment before documentclass at file start", () => {
    const doc = "\\documentclass[conference]{IEEEtran}";
    const insert = "% agent-smoke-test-54";
    expect(normalizeInsertAtCursorText(insert, doc, 0)).toBe("% agent-smoke-test-54\n");
  });

  it("leaves text unchanged when it already ends with a newline", () => {
    const doc = "\\documentclass{article}";
    const insert = "% comment\n";
    expect(normalizeInsertAtCursorText(insert, doc, 0)).toBe("% comment\n");
  });

  it("leaves text unchanged when the next character is whitespace", () => {
    const doc = "See  Smith";
    const insert = "\\cite{smith2020}";
    expect(normalizeInsertAtCursorText(insert, doc, 4)).toBe("\\cite{smith2020}");
  });

  it("leaves text unchanged at end of file", () => {
    const doc = "\\end{document}";
    const insert = "% trailing note";
    expect(normalizeInsertAtCursorText(insert, doc, doc.length)).toBe("% trailing note");
  });

  it("places a mid-line comment on its own line", () => {
    const doc = "helloworld";
    const insert = "% note";
    expect(normalizeInsertAtCursorText(insert, doc, 5)).toBe("\n% note\n");
  });

  it("adds only a trailing newline for non-comment inline inserts", () => {
    const doc = "SeeSmith";
    const insert = "\\cite{smith2020}";
    expect(normalizeInsertAtCursorText(insert, doc, 3)).toBe("\\cite{smith2020}\n");
  });
});

describe("applyAiClientActions replace_lines ordering", () => {
  it("applies multiple replace_lines bottom-up against original line numbers", async () => {
    const content = [
      "\\documentclass{article}",
      "line2",
      "line3",
      "line4",
      "line5",
      "\\begin{document}",
      "\\end{document}",
    ].join("\n");

    const fileContents: Record<string, string> = { "main.tex": content };
    const actions: AiClientAction[] = [
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "fixed2",
        label: "Replaced line 2 in main.tex",
      },
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 5,
        endLine: 5,
        replace: "fixed5",
        label: "Replaced line 5 in main.tex",
      },
    ];

    const result = await applyAiClientActions(actions, {
      activeFile: null,
      editorView: null,
      fileContents,
      hasSelection: false,
      saveFile: async (path, next) => {
        fileContents[path] = next;
      },
    });

    expect(result.applied).toHaveLength(2);
    expect(fileContents["main.tex"]).toBe(
      [
        "\\documentclass{article}",
        "fixed2",
        "line3",
        "line4",
        "fixed5",
        "\\begin{document}",
        "\\end{document}",
      ].join("\n")
    );
  });

  it("applyReplaceLinesToFileContent matches single-line edits", () => {
    expect(
      applyReplaceLinesToFileContent("\\documentclass{article}\n\\usepackage\n", {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{amsmath}",
        label: "",
      })
    ).toBe("\\documentclass{article}\n\\usepackage{amsmath}\n");
  });
});
