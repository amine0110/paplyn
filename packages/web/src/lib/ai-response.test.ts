import { describe, expect, it } from "vitest";
import {
  collectPapersFromToolResults,
  collectClientActionsFromToolResults,
  collectToolResultTexts,
  collectUsedPlugins,
  formatToolResultsAsAssistantMessage,
  hadToolActivity,
  summarizeToolResult,
  toAppliedActionSummaries,
  usedLiteratureSearch,
} from "./ai-response";
import { getEnabledAiPlugins } from "./ai-plugins";

function mockResult(overrides: Record<string, unknown> = {}) {
  return {
    text: "",
    toolCalls: [],
    toolResults: [],
    steps: [],
    response: { messages: [] },
    ...overrides,
  } as Parameters<typeof hadToolActivity>[0];
}

const literaturePayload = {
  kind: "literature-search" as const,
  summary: 'Found 3 paper(s) for "transformers" via live semantic-scholar search.',
  query: "transformers",
  source: "semantic-scholar" as const,
  papers: [
    {
      title: "Attention Is All You Need",
      year: 2017,
      authors: ["Vaswani"],
      venue: "NeurIPS",
      doi: null,
      url: null,
      source: "semantic-scholar" as const,
    },
  ],
};

describe("ai-response helpers", () => {
  it("detects tool activity across steps", () => {
    const result = mockResult({
      steps: [{ toolCalls: [{ toolName: "search_literature" }], toolResults: [] }],
    });
    expect(hadToolActivity(result)).toBe(true);
  });

  it("collects summary text from structured literature tool results", () => {
    const result = mockResult({
      toolResults: [{ toolName: "search_literature", result: literaturePayload }],
    });
    expect(collectToolResultTexts(result)).toEqual([literaturePayload.summary]);
  });

  it("formats literature tool output as fallback assistant text", () => {
    const result = mockResult({
      toolResults: [{ toolName: "search_literature", result: literaturePayload }],
    });
    expect(formatToolResultsAsAssistantMessage(result)).toContain("Found 3 paper(s)");
  });

  it("formats workspace tool output as human-readable fallback text", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "get_file",
          result: {
            path: "main.tex",
            content: "\\usepackage{amsmath}",
            startLine: 2,
            endLine: 2,
            totalLines: 5,
            note: "",
            error: "",
          },
        },
        {
          toolName: "apply_edit",
          result: {
            kind: "client-action-rejected",
            reason: "search text not found in file",
          },
        },
      ],
    });
    expect(formatToolResultsAsAssistantMessage(result)).toBe(
      "Read main.tex (line 2). search text not found in file"
    );
  });

  it("summarizes applied edits with action labels", () => {
    expect(
      summarizeToolResult("apply_edit", {
        kind: "client-action",
        action: {
          type: "apply_edit",
          file: "main.tex",
          search: "foo",
          replace: "bar",
          label: "Applied edit to main.tex",
        },
      })
    ).toBe("Applied edit to main.tex");
  });

  it("returns null when no tool results exist", () => {
    expect(formatToolResultsAsAssistantMessage(mockResult())).toBeNull();
  });

  it("detects literature search tool usage", () => {
    const result = mockResult({
      toolCalls: [{ toolName: "search_literature" }],
    });
    expect(usedLiteratureSearch(result)).toBe(true);
  });

  it("collects used plugins with OpenAlex fallback label", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "search_literature",
          result: { ...literaturePayload, source: "openalex" },
        },
      ],
    });
    const used = collectUsedPlugins(result, getEnabledAiPlugins());
    expect(used).toEqual([
      expect.objectContaining({
        id: "semantic-scholar",
        displayName: "OpenAlex",
        source: "openalex",
      }),
    ]);
  });

  it("collects structured papers from tool results", () => {
    const result = mockResult({
      toolResults: [{ toolName: "search_literature", result: literaturePayload }],
    });
    expect(collectPapersFromToolResults(result)).toHaveLength(1);
    expect(collectPapersFromToolResults(result)[0]?.title).toBe("Attention Is All You Need");
  });

  it("collects client edit actions from tool results", () => {
    const action = {
      type: "apply_edit" as const,
      file: "main.tex",
      search: "foo",
      replace: "bar",
      label: "Applied edit to main.tex",
    };
    const result = mockResult({
      toolResults: [
        {
          toolName: "apply_edit",
          result: { kind: "client-action", action },
        },
      ],
    });
    expect(collectClientActionsFromToolResults(result)).toEqual([action]);
    expect(toAppliedActionSummaries([action])).toEqual([
      { label: "Applied edit to main.tex", type: "apply_edit", file: "main.tex" },
    ]);
  });

  it("summarizes replace_lines with action labels", () => {
    expect(
      summarizeToolResult("replace_lines", {
        kind: "client-action",
        action: {
          type: "replace_lines",
          file: "main.tex",
          startLine: 3,
          endLine: 3,
          replace: "\\usepackage{amsmath}",
          label: "Replaced line 3 in main.tex",
        },
      })
    ).toBe("Replaced line 3 in main.tex");
  });

  it("collects replace_lines actions from tool results", () => {
    const action = {
      type: "replace_lines" as const,
      file: "main.tex",
      startLine: 3,
      endLine: 3,
      replace: "\\usepackage{amsmath}",
      label: "Replaced line 3 in main.tex",
    };
    const result = mockResult({
      toolResults: [
        {
          toolName: "replace_lines",
          result: { kind: "client-action", action },
        },
      ],
    });
    expect(collectClientActionsFromToolResults(result)).toEqual([action]);
    expect(toAppliedActionSummaries([action])).toEqual([
      { label: "Replaced line 3 in main.tex", type: "replace_lines", file: "main.tex" },
    ]);
  });
});
