import { describe, expect, it } from "vitest";
import { buildCompileFixNoEditMessage } from "./ai-compile-fix-failure";

describe("buildCompileFixNoEditMessage", () => {
  it("returns one sentence when reads happened but no edit applied", () => {
    const message = buildCompileFixNoEditMessage({
      errors: [{ message: "Missing bracket", file: "main.tex", line: 12 }],
      getFileCalls: [{ path: "main.tex", startLine: 2, endLine: 22 }],
      steps: [
        {
          toolCalls: [{ toolName: "get_file", args: {} }],
          toolResults: [
            {
              toolName: "get_file",
              result: { path: "main.tex", startLine: 2, endLine: 22 },
            },
          ],
        },
      ] as never,
    });

    expect(message).toContain("main.tex");
    expect(message).toContain("line 12");
    expect(message).toContain("could not apply an edit");
    expect(message.split(".").length).toBeLessThanOrEqual(3);
  });

  it("mentions rejected edits", () => {
    const message = buildCompileFixNoEditMessage({
      errors: [{ message: "main.tex:12: error", file: "main.tex", line: 12 }],
      getFileCalls: [{ path: "main.tex", startLine: 2, endLine: 22 }],
      steps: [
        {
          toolCalls: [],
          toolResults: [
            {
              toolName: "replace_lines",
              result: {
                kind: "client-action-rejected",
                reason: "invalid range",
              },
            },
          ],
        },
      ] as never,
    });

    expect(message).toContain("edit was rejected");
  });
});
