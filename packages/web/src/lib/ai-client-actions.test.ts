import { describe, expect, it } from "vitest";
import {
  applyActionToFileContent,
  countOccurrences,
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
        startLine: 0,
        endLine: 0,
      },
      { texFiles: files, hasSelection: false }
    );
    expect(result).toBeNull();
  });

  it("validates apply_edit with line range sentinels", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "",
        replace: "Replaced line",
        startLine: 3,
        endLine: 3,
      },
      { texFiles, hasSelection: false }
    );
    expect(result?.action.type).toBe("apply_edit");
    if (result?.action.type === "apply_edit") {
      expect(result.action.search).toBeUndefined();
      expect(result.action.startLine).toBe(3);
      expect(result.action.endLine).toBe(3);
    }
  });

  it("rejects apply_edit when neither search nor line range is provided", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "",
        replace: "text",
        startLine: 0,
        endLine: 0,
      },
      { texFiles, hasSelection: false }
    );
    expect(result).toBeNull();
  });

  it("validates apply_edit with unique search", () => {
    const result = validateClientAction(
      {
        type: "apply_edit",
        file: "main.tex",
        search: "Hello world",
        replace: "Hello universe",
        startLine: 0,
        endLine: 0,
      },
      { texFiles, hasSelection: false }
    );
    expect(result?.action.type).toBe("apply_edit");
    if (result?.action.type === "apply_edit") {
      expect(result.action.file).toBe("main.tex");
    }
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
