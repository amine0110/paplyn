import { describe, expect, it } from "vitest";
import {
  applyActionToFileContent,
  applyLinesReplace,
  applyReplaceLinesToFileContent,
  countOccurrences,
  findOccurrenceLineNumbers,
  lineRangeToOffsets,
  stripLineNumberPrefixes,
  validateClientAction,
} from "./ai-client-actions";

const texFiles = new Map<string, string>([
  ["main.tex", "\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}\n"],
]);

describe("ai-client-actions", () => {
  it("validates insert_at_cursor", () => {
    const result = validateClientAction(
      { type: "insert_at_cursor", text: "\\cite{smith2020}" },
      { texFiles, hasSelection: false }
    );
    expect(result?.action.type).toBe("insert_at_cursor");
    expect(result?.action.label).toContain("Inserted");
  });

  it("rejects apply_edit when search is ambiguous", () => {
    const files = new Map([["main.tex", "foo\nfoo\n"]]);
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "foo",
        replace: "bar",
      },
      { texFiles: files, hasSelection: false }
    );
    expect(result).toEqual({
      rejected: true,
      reason:
        "search text is ambiguous (2 matches at lines 1, 2) (search: \"foo\"). Use replace_lines for the cited line range instead of apply_edit.",
      matchCount: 2,
      matchLineNumbers: [1, 2],
      searchPreview: "foo",
      emptySearch: false,
    });
  });

  it("rejects apply_edit when search is empty", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "",
        replace: "text",
      },
      { texFiles, hasSelection: false }
    );
    expect(result).toEqual({
      rejected: true,
      reason: "search text is empty. Use replace_lines when compile errors cite a line number.",
      matchCount: 0,
      matchLineNumbers: [],
      searchPreview: "",
      emptySearch: true,
    });
  });

  it("classifies prefix-stripped bare usepackage as ambiguous, not not-found", () => {
    const bareLine = "\\usepackage  ";
    const lines = [
      "\\documentclass{article}",
      bareLine,
      "\\usepackage{amsmath}",
      bareLine,
      "\\usepackage{graphicx}",
      bareLine,
    ];
    const files = new Map([["main.tex", lines.join("\n")]]);

    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: `3: ${bareLine}`,
        replace: "\\usepackage{amsmath}",
      },
      { texFiles: files, hasSelection: false }
    );

    expect("rejected" in result && result.rejected).toBe(true);
    if ("rejected" in result && result.rejected) {
      expect(result.matchCount).toBe(3);
      expect(result.matchLineNumbers).toEqual([2, 4, 6]);
      expect(result.searchPreview).toBe(bareLine);
      expect(result.reason).toContain("ambiguous");
      expect(result.reason).not.toContain("0 matches");
    }
  });

  it("validates apply_edit with unique search", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "Hello world",
        replace: "Hello universe",
      },
      { texFiles, hasSelection: false }
    );
    expect(result?.action.type).toBe("apply_edit");
    if ("action" in result && result.action.type === "apply_edit") {
      expect(result.action.file).toBe("main.tex");
      expect(result.action.search).toBe("Hello world");
    }
  });

  it("accepts apply_edit when search uses legacy line-number prefixes", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "3: Hello world",
        replace: "Hello universe",
      },
      { texFiles, hasSelection: false }
    );
    expect("action" in result && result.action.type).toBe("apply_edit");
    if ("action" in result && result.action.type === "apply_edit") {
      expect(result.action.search).toBe("Hello world");
      expect(result.action.replace).toBe("Hello universe");
    }
  });

  it("strips one line-number prefix per line", () => {
    expect(stripLineNumberPrefixes("3: \\usepackage{amsmath}\n4: \\begin{document}")).toBe(
      "\\usepackage{amsmath}\n\\begin{document}"
    );
  });

  it("applies search/replace to file content", () => {
    const updated = applyActionToFileContent("Hello world", {
      type: "apply_edit",
      file: "main.tex",
      search: "world",
      replace: "universe",
      label: "test",
    });
    expect(updated).toBe("Hello universe");
  });

  it("counts occurrences", () => {
    expect(countOccurrences("aaa", "a")).toBe(3);
    expect(countOccurrences("aaa", "aa")).toBe(1);
  });

  it("finds occurrence line numbers for ambiguous search", () => {
    expect(findOccurrenceLineNumbers("\\usepackage\n\\usepackage", "\\usepackage")).toEqual([1, 2]);
  });

  it("validates replace_lines for a single line", () => {
    const files = new Map([
      ["main.tex", "\\documentclass{article}\n\\usepackage\n\\begin{document}\n"],
    ]);
    const result = validateClientAction(
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{amsmath}",
      },
      { texFiles: files, hasSelection: false }
    );
    expect("action" in result && result.action.type).toBe("replace_lines");
    if ("action" in result && result.action.type === "replace_lines") {
      expect(result.action.label).toBe("Replaced line 2 in main.tex");
      expect(result.action.replace).toBe("\\usepackage{amsmath}");
    }
  });

  it("applies replace_lines to file content", () => {
    const updated = applyReplaceLinesToFileContent(
      "\\documentclass{article}\n\\usepackage\n\\begin{document}\n",
      {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{amsmath}",
        label: "test",
      }
    );
    expect(updated).toBe("\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n");
  });

  it("applyLinesReplace rejects out-of-range startLine", () => {
    expect(
      applyLinesReplace("\\documentclass{article}", 5, 5, "text")
    ).toEqual({
      ok: false,
      reason: "startLine 5 is past the end of the file (1 lines).",
    });
  });

  it("lineRangeToOffsets maps inclusive line ranges", () => {
    const content = "a\nb\nc\nd";
    expect(lineRangeToOffsets(content, 3, 3)).toEqual({ from: 4, to: 5 });
    expect(lineRangeToOffsets(content, 2, 3)).toEqual({ from: 2, to: 5 });
  });
});
