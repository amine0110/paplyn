import { describe, expect, it } from "vitest";
import {
  createWorkspaceTools,
  GET_FILE_MAX_LINES,
  GET_FILE_RETRY_ATTEMPTS,
  listTexFiles,
  normalizeTexPath,
  readTexFile,
  resolveTexFilePath,
} from "./workspace-tools";
import { buildGetFileWindow } from "@/lib/ai-compile-fix-context";

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

  it("get_file returns a raw line window without line-number prefixes", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({
      path: "main.tex",
      startLine: 2,
      endLine: 3,
    });

    expect(result.path).toBe("main.tex");
    expect(result.content).toBe("\\usepackage{amsmath}\n\\begin{document}");
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
    expect(result.content).toBe("\\documentclass{article}");
    expect(result.error).toBe("");
  });

  it("get_file resolves leading-slash path aliases to main.tex", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({
      path: "/main.tex",
      startLine: 1,
      endLine: 1,
    });

    expect(result.path).toBe("main.tex");
    expect(result.content).toBe("\\documentclass{article}");
    expect(result.error).toBe("");
  });

  it("resolveTexFilePath maps basename aliases to a unique project file", () => {
    expect(resolveTexFilePath(texFiles, "intro.tex")).toBe("sections/intro.tex");
    expect(normalizeTexPath("/main.tex")).toBe("main.tex");
  });

  it("get_file retries then succeeds when refresh supplies the file", async () => {
    const snapshot = new Map<string, string>();
    let refreshCount = 0;
    const tools = createWorkspaceTools(
      { texFiles: snapshot, hasSelection: false },
      {
        refreshTexFiles: async () => {
          refreshCount += 1;
          snapshot.set(
            "main.tex",
            "\\documentclass{article}\n\\begin{document}\n\\end{document}\n"
          );
          return snapshot;
        },
      }
    );

    const result = await tools.get_file.execute({
      path: "main.tex",
      startLine: 1,
      endLine: 1,
    });

    expect(refreshCount).toBeGreaterThan(0);
    expect(refreshCount).toBeLessThan(GET_FILE_RETRY_ATTEMPTS);
    expect(result.error).toBe("");
    expect(result.path).toBe("main.tex");
    expect(result.content).toBe("\\documentclass{article}");
  });

  it("compile-fix preloads cited file for the first targeted get_file call", async () => {
    const citedLine = 2;
    const { startLine, endLine } = buildGetFileWindow(citedLine);
    const tools = createWorkspaceTools(
      { texFiles, hasSelection: false },
      {
        compileFix: true,
        citedErrorLocation: { file: "main.tex", line: citedLine },
      }
    );

    const result = await tools.get_file.execute({
      path: "main.tex",
      startLine,
      endLine,
    });

    expect(result.error).toBe("");
    expect(result.path).toBe("main.tex");
    expect(result.content).toContain("\\usepackage{amsmath}");
    expect(result.startLine).toBe(startLine);
    expect(result.endLine).toBe(5);
  });

  it("get_file returns retryable errors listing available project paths", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({
      path: "missing.tex",
      startLine: 1,
      endLine: 1,
    });

    expect(result.error).toContain("missing.tex");
    expect(result.error).toContain("Retry get_file");
    expect(result.error).toContain("main.tex");
    expect(result.error).toContain("sections/intro.tex");
  });

  it("caps get_file calls when maxGetFileCalls is set", async () => {
    const tools = createWorkspaceTools(
      { texFiles, hasSelection: false },
      { maxGetFileCalls: 2 }
    );

    await tools.get_file.execute({ path: "main.tex", startLine: 1, endLine: 1 });
    await tools.get_file.execute({ path: "main.tex", startLine: 2, endLine: 2 });
    const blocked = await tools.get_file.execute({ path: "main.tex", startLine: 3, endLine: 3 });

    expect(blocked.error).toContain("get_file limit reached");
    expect(blocked.content).toBe("");
  });

  it("caps oversized line windows and notes how to read more", () => {
    const result = readTexFile(longTexFiles, "main.tex", 1, 150);

    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(GET_FILE_MAX_LINES);
    expect(result.totalLines).toBe(150);
    expect(result.note).toContain(`Window capped to ${GET_FILE_MAX_LINES} lines`);
    expect(result.content.split("\n")).toHaveLength(GET_FILE_MAX_LINES);
    expect(result.content).toContain("Line 1");
    expect(result.content).toContain(`Line ${GET_FILE_MAX_LINES}`);
  });

  it("apply_edit rejects empty search with a actionable reason", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.apply_edit.execute({
      file: "main.tex",
      search: "",
      replace: "text",
    });

    expect(result).toEqual({
      kind: "client-action-rejected",
      reason: "search text is empty. Use replace_lines when compile errors cite a line number.",
      matchCount: 0,
      emptySearch: true,
    });
  });

  it("apply_edit rejects ambiguous search with occurrence metadata", async () => {
    const ambiguousFiles = new Map([
      ["main.tex", "\\usepackage{amsmath}\n\\usepackage{graphicx}\n"],
    ]);
    const tools = createWorkspaceTools({ texFiles: ambiguousFiles, hasSelection: false });
    const result = await tools.apply_edit.execute({
      file: "main.tex",
      search: "\\usepackage",
      replace: "\\usepackage{amsmath}",
    });

    expect(result).toEqual({
      kind: "client-action-rejected",
      reason:
        "search text is ambiguous (2 matches at lines 1, 2) (search: \"\\usepackage\"). Use replace_lines for the cited line range instead of apply_edit.",
      matchCount: 2,
      matchLineNumbers: [1, 2],
      searchPreview: "\\usepackage",
    });
  });

  it("apply_edit accepts search with legacy line-number prefixes from get_file", async () => {
    const tools = createWorkspaceTools({ texFiles, hasSelection: false });
    const result = await tools.apply_edit.execute({
      file: "main.tex",
      search: "2: \\usepackage{amsmath}",
      replace: "\\usepackage{amsmath,amssymb}",
    });

    expect(result).toEqual({
      kind: "client-action",
      action: {
        type: "apply_edit",
        file: "main.tex",
        search: "\\usepackage{amsmath}",
        replace: "\\usepackage{amsmath,amssymb}",
        label: "Applied edit to main.tex",
      },
    });
  });

  it("replace_lines fixes bare usepackage on a known line", async () => {
    const bareFiles = new Map([
      ["main.tex", "\\documentclass{article}\n\\usepackage\n\\begin{document}\n"],
    ]);
    const tools = createWorkspaceTools({ texFiles: bareFiles, hasSelection: false });
    const result = await tools.replace_lines.execute({
      file: "main.tex",
      startLine: 2,
      endLine: 2,
      replace: "\\usepackage{amsmath}",
    });

    expect(result).toEqual({
      kind: "client-action",
      action: {
        type: "replace_lines",
        file: "main.tex",
        startLine: 2,
        endLine: 2,
        replace: "\\usepackage{amsmath}",
        label: "Replaced line 2 in main.tex",
      },
    });
  });

  it("rejects compile-fix replace_lines that prepend preamble before documentclass", async () => {
    const content = [
      "\\documentclass[conference]{IEEEtran}",
      "\\usepackage{amsmath}",
      "\\begin{document}",
      "\\end{document}",
    ].join("\n");
    const files = new Map([["main.tex", content]]);
    const tools = createWorkspaceTools(
      { texFiles: files, hasSelection: false },
      { compileFix: true }
    );
    const result = await tools.replace_lines.execute({
      file: "main.tex",
      startLine: 1,
      endLine: 1,
      replace:
        "\\usepackage  \\title{Your Paper Title Here\\documentclass[conference]{IEEEtran}",
    });

    expect(result.kind).toBe("client-action-rejected");
    if (result.kind === "client-action-rejected") {
      expect(result.reason).toContain("before \\documentclass");
    }
  });

  it("rejects a second compile-fix replace_lines that would duplicate documentclass", async () => {
    const content = ["\\usepackage", "\\title{Foo}", "\\begin{document}", "\\end{document}"].join(
      "\n"
    );
    const files = new Map([["main.tex", content]]);
    const tools = createWorkspaceTools(
      { texFiles: files, hasSelection: false },
      { compileFix: true }
    );
    const docclass = "\\documentclass[conference]{IEEEtran}";

    const first = await tools.replace_lines.execute({
      file: "main.tex",
      startLine: 1,
      endLine: 1,
      replace: docclass,
    });
    expect(first.kind).toBe("client-action");

    const second = await tools.replace_lines.execute({
      file: "main.tex",
      startLine: 2,
      endLine: 2,
      replace: docclass,
    });
    expect(second.kind).toBe("client-action-rejected");
    if (second.kind === "client-action-rejected") {
      expect(second.reason).toContain("\\documentclass");
    }
  });
});
