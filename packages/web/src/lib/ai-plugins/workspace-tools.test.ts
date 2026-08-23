import { describe, expect, it } from "vitest";
import {
  createWorkspaceTools,
  GET_FILE_MAX_LINES,
  listTexFiles,
  readTexFile,
} from "./workspace-tools";

const texFiles = new Map<string, string>([
  ["main.tex", "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\\end{document}\n"],
  ["sections/intro.tex", "\\section{Introduction}\nHello.\n"],
]);

const longTex = Array.from({ length: 150 }, (_, i) => `Line ${i + 1}`).join("\n");
const longTexFiles = new Map<string, string>([["main.tex", longTex]]);

describe("workspace-tools", () => {
  it("listTexFiles returns sorted project .tex paths", () => {
    expect(listTexFiles(texFiles)).toEqual({
      files: ["main.tex", "sections/intro.tex"],
      count: 2,
      error: "",
    });
  });

  it("list_files tool returns project paths", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.list_files.execute({ scope: "project" });

    expect(result).toEqual({
      files: ["main.tex", "sections/intro.tex"],
      count: 2,
      error: "",
    });
  });

  it("get_file returns a numbered line window", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({
      path: "main.tex",
      startLine: 2,
      endLine: 3,
    });

    expect(result.path).toBe("main.tex");
    expect(result.content).toBe("2: \\usepackage{amsmath}\n3: \\begin{document}");
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(3);
    expect(result.totalLines).toBe(5);
    expect(result.note).toContain("Lines 1-1 not shown");
    expect(result.note).toContain("Lines 4-5 not shown");
    expect(result.error).toBe("");
  });

  it("readTexFile returns a clear error for a missing project file", () => {
    expect(
      readTexFile(texFiles, "missing.tex", 1, 10)
    ).toEqual({
      path: "missing.tex",
      content: "",
      startLine: 1,
      endLine: 1,
      totalLines: 0,
      note: "",
      error: 'File "missing.tex" is not in this project.',
    });
  });

  it("get_file normalizes leading ./ in paths", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({
      path: "./main.tex",
      startLine: 1,
      endLine: 1,
    });

    expect(result.path).toBe("main.tex");
    expect(result.content).toBe("1: \\documentclass{article}");
    expect(result.error).toBe("");
  });

  it("caps oversized line windows and notes how to read more", () => {
    const result = readTexFile(longTexFiles, "main.tex", 1, 150);

    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(GET_FILE_MAX_LINES);
    expect(result.totalLines).toBe(150);
    expect(result.note).toContain(`Window capped to ${GET_FILE_MAX_LINES} lines`);
    expect(result.content.split("\n")).toHaveLength(GET_FILE_MAX_LINES);
    expect(result.content).toContain("1: Line 1");
    expect(result.content).toContain(`${GET_FILE_MAX_LINES}: Line ${GET_FILE_MAX_LINES}`);
  });

  it("apply_edit rejects empty search via validation wrapper", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.apply_edit.execute({
      file: "main.tex",
      search: "",
      replace: "text",
    });

    expect(result).toEqual({
      kind: "client-action-rejected",
      reason: "Edit could not be validated. Check file path, search text, and size limits.",
    });
  });
});
