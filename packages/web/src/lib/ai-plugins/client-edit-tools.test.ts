import { describe, expect, it } from "vitest";
import { createClientEditTools } from "./client-edit-tools";

const texFiles = new Map<string, string>([
  ["main.tex", "\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\\end{document}\n"],
]);

describe("createClientEditTools", () => {
  it("get_file returns path and content for an existing project file", async () => {
    const tools = createClientEditTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({ path: "main.tex" });

    expect(result).toEqual({
      path: "main.tex",
      content: texFiles.get("main.tex"),
      error: "",
    });
  });

  it("get_file returns a clear error for a missing project file", async () => {
    const tools = createClientEditTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({ path: "missing.tex" });

    expect(result).toEqual({
      path: "missing.tex",
      content: "",
      error: 'File "missing.tex" is not in this project.',
    });
  });

  it("get_file normalizes leading ./ in paths", async () => {
    const tools = createClientEditTools({ texFiles, hasSelection: false });
    const result = await tools.get_file.execute({ path: "./main.tex" });

    expect(result.path).toBe("main.tex");
    expect(result.content).toBe(texFiles.get("main.tex"));
    expect(result.error).toBe("");
  });

  it("apply_edit rejects empty search via validation wrapper", async () => {
    const tools = createClientEditTools({ texFiles, hasSelection: false });
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
