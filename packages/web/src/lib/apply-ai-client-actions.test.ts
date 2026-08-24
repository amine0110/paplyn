import { describe, expect, it } from "vitest";
import { applyReplaceLinesToFileContent } from "./ai-client-actions";
import { applyAiClientActions, normalizeInsertAtCursorText } from "./apply-ai-client-actions";
import type { AiClientAction } from "./ai-client-actions";
import { countBeginDocumentInFirstCopy } from "./ai-compile-fix-validation";

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

describe("applyAiClientActions selection range", () => {
  it("replaces captured selection range for replace_selection", async () => {
    let doc = "I can't beleive what you saide";
    const from = 0;
    const to = doc.length;

    const editorView = {
      state: {
        doc: { toString: () => doc },
        selection: { main: { from: 5, to: 5 } },
      },
      dispatch: (update: { changes: { from: number; to: number; insert: string } }) => {
        doc =
          doc.slice(0, update.changes.from) +
          update.changes.insert +
          doc.slice(update.changes.to);
      },
    };

    const result = await applyAiClientActions(
      [{ type: "replace_selection", text: "I can't believe what you said", label: "Replaced selection" }],
      {
        activeFile: "main.tex",
        editorView: editorView as never,
        fileContents: { "main.tex": doc },
        hasSelection: true,
        selectionRange: { from, to },
        saveFile: async () => {},
      }
    );

    expect(result.applied).toHaveLength(1);
    expect(doc).toBe("I can't believe what you said");
  });

  it("inserts at cursor span when there is no selection", async () => {
    let doc = "\\documentclass{article}";
    const from = doc.length;
    const to = doc.length;

    const editorView = {
      state: {
        doc: { toString: () => doc },
        selection: { main: { from, to } },
      },
      dispatch: (update: { changes: { from: number; to: number; insert: string } }) => {
        doc =
          doc.slice(0, update.changes.from) +
          update.changes.insert +
          doc.slice(update.changes.to);
      },
    };

    const result = await applyAiClientActions(
      [{ type: "insert_at_cursor", text: "% note", label: "Inserted text at cursor" }],
      {
        activeFile: "main.tex",
        editorView: editorView as never,
        fileContents: { "main.tex": doc },
        hasSelection: false,
        selectionRange: { from, to },
        saveFile: async () => {},
      }
    );

    expect(result.applied).toHaveLength(1);
    expect(doc).toBe("\\documentclass{article}% note");
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

  it("skips duplicate documentclass replace_lines during compile-fix batch apply", async () => {
    const docclass = "\\documentclass[conference]{IEEEtran}";
    const content = ["\\usepackage", "\\title{Foo}", "\\begin{document}", "\\end{document}"].join(
      "\n"
    );
    const fileContents: Record<string, string> = { "main.tex": content };
    const actions: AiClientAction[] = [
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 1,
        endLine: 1,
        replace: docclass,
        label: "Replaced line 1 in main.tex",
      },
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: docclass,
        label: "Replaced line 2 in main.tex",
      },
    ];

    const result = await applyAiClientActions(actions, {
      activeFile: null,
      editorView: null,
      fileContents,
      hasSelection: false,
      compileFix: true,
      saveFile: async (path, next) => {
        fileContents[path] = next;
      },
    });

    expect(result.applied).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(fileContents["main.tex"].split("\n").filter((l) => l.includes("\\documentclass"))).toHaveLength(
      1
    );
  });

  it("auto-retry compile-fix skips replace_lines that invent second begin{document}", async () => {
    const content = [
      "\\documentclass[conference]{IEEEtran}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "\\maketitle",
      "\\end{document}",
    ].join("\n");
    const fileContents: Record<string, string> = { "main.tex": content };
    const actions: AiClientAction[] = [
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 4,
        endLine: 4,
        replace: "\\begin{document}\n\\maketitle",
        label: "Replaced line 4 in main.tex",
      },
    ];

    const result = await applyAiClientActions(actions, {
      activeFile: null,
      editorView: null,
      fileContents,
      hasSelection: false,
      compileFix: true,
      saveFile: async (path, next) => {
        fileContents[path] = next;
      },
    });

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(countBeginDocumentInFirstCopy(fileContents["main.tex"])).toBe(1);
  });

  it("skips replace_lines that stack a macro sibling below an unchanged duplicate line", async () => {
    const content = [
      "\\textit{University} \\\\",
      "",
      "\\textit{University} \\\\",
    ].join("\n");
    const fileContents: Record<string, string> = { "main.tex": content };
    const actions: AiClientAction[] = [
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "\\textit{UMONS} \\\\",
        label: "Replaced line 2 in main.tex",
      },
    ];

    const result = await applyAiClientActions(actions, {
      activeFile: null,
      editorView: null,
      fileContents,
      hasSelection: false,
      saveFile: async () => {},
    });

    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(fileContents["main.tex"]).toBe(content);
  });

  it("apply_edit uses live editor document when active file is open", async () => {
    const staleContent = "\\documentclass{article}\nold line\n\\end{document}";
    const liveContent = "\\documentclass{article}\nunique-marker-old\n\\end{document}";
    let doc = liveContent;

    const editorView = {
      state: {
        doc: { toString: () => doc },
        selection: { main: { from: 0, to: 0 } },
      },
      dispatch: (update: { changes: { from: number; to: number; insert: string } }) => {
        doc =
          doc.slice(0, update.changes.from) +
          update.changes.insert +
          doc.slice(update.changes.to);
      },
    };

    const fileContents: Record<string, string> = { "main.tex": staleContent };
    const result = await applyAiClientActions(
      [
        {
          type: "apply_edit",
          file: "main.tex",
          search: "unique-marker-old",
          replace: "unique-marker-new",
          label: "Applied edit to main.tex",
        },
      ],
      {
        activeFile: "main.tex",
        editorView: editorView as never,
        fileContents,
        hasSelection: false,
        saveFile: async () => {},
      }
    );

    expect(result.applied).toHaveLength(1);
    expect(doc).toContain("unique-marker-new");
    expect(doc).not.toContain("unique-marker-old");
    expect(fileContents["main.tex"]).toContain("unique-marker-new");
  });
});
