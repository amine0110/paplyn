import { describe, expect, it } from "vitest";
import {
  applyActionToFileContent,
  countOccurrences,
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
        "search text is ambiguous (multiple matches). Retry with a longer exact substring that appears once.",
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
      reason:
        "Search text is empty or exceeds size limits. Retry with an exact unnumbered substring from get_file that appears once.",
    });
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
});
