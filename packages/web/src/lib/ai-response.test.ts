import { describe, expect, it } from "vitest";
import {
  collectPapersFromToolResults,
  collectClientActionsFromToolResults,
  collectToolReadChips,
  collectToolResultTexts,
  collectUsedPlugins,
  formatToolResultsAsAssistantMessage,
  formatAppliedActionsAsAssistantMessage,
  hadToolActivity,
  NO_EDIT_FALLBACK_MESSAGE,
  resolveEmptyAssistantFallback,
  summarizeToolResult,
  toAppliedActionSummaries,
  usedLiteratureSearch,
} from "./ai-response";
import { getEnabledAiPlugins } from "./ai-plugins";
import { WORKSPACE_CHAT_SUFFIX, WORKSPACE_SYSTEM_PROMPT } from "./ai-plugins/workspace-tools";

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

  it("does not use get_file read logs as fallback assistant text", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "get_file",
          result: {
            path: "main.tex",
            content: "\\usepackage{amsmath}",
            startLine: 1,
            endLine: 100,
            totalLines: 200,
            note: "",
            error: "",
          },
        },
        {
          toolName: "get_file",
          result: {
            path: "main.tex",
            content: "\\author{Foo}",
            startLine: 10,
            endLine: 30,
            totalLines: 200,
            note: "",
            error: "",
          },
        },
      ],
    });
    expect(formatToolResultsAsAssistantMessage(result)).toBeNull();
    expect(resolveEmptyAssistantFallback({ result, actions: [] })).toBe(NO_EDIT_FALLBACK_MESSAGE);
  });

  it("collects read chips without putting them in the assistant bubble", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "get_file",
          result: {
            path: "main.tex",
            content: "\\author{Foo}",
            startLine: 10,
            endLine: 30,
            totalLines: 200,
            note: "",
            error: "",
          },
        },
      ],
    });
    expect(collectToolReadChips(result)).toEqual([
      { label: "Read main.tex (lines 10–30)", path: "main.tex" },
    ]);
    expect(resolveEmptyAssistantFallback({ result, actions: [] })).toBe(NO_EDIT_FALLBACK_MESSAGE);
  });

  it("formats rejected edits without read logs in fallback assistant text", () => {
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
    expect(formatToolResultsAsAssistantMessage(result)).toBe("search text not found in file");
  });

  it("surfaces applied edit labels when model text is empty", () => {
    const action = {
      type: "apply_edit" as const,
      file: "main.tex",
      search: "University of Old",
      replace: "UMONS",
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
    expect(formatAppliedActionsAsAssistantMessage([action])).toBe("Applied edit to main.tex");
    expect(resolveEmptyAssistantFallback({ result, actions: [action] })).toBe(
      "Applied edit to main.tex"
    );
  });

  it("surfaces replace_lines labels when model text is empty", () => {
    const action = {
      type: "replace_lines" as const,
      file: "main.tex",
      startLine: 3,
      endLine: 3,
      replace: "\\affiliation{UMONS}",
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
    expect(resolveEmptyAssistantFallback({ result, actions: [action] })).toBe(
      "Replaced line 3 in main.tex"
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

  it("collects replace_lines actions without duplicates from mirrored tool results", () => {
    const action = {
      type: "replace_lines" as const,
      file: "main.tex",
      startLine: 1,
      endLine: 1,
      replace: "\\documentclass{article}",
      label: "Replaced line 1 in main.tex",
    };
    const payload = { kind: "client-action" as const, action };
    const result = mockResult({
      toolResults: [{ toolName: "replace_lines", result: payload }],
      steps: [{ toolCalls: [], toolResults: [{ toolName: "replace_lines", result: payload }] }],
    });
    expect(collectClientActionsFromToolResults(result)).toEqual([action]);
  });

  it("workspace system prompt tells the model to apply paper change requests", () => {
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("change requests get edits");
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("apply_edit or replace_lines");
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("Do not spend the whole turn reading overlapping get_file");
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("Add vs fill intent");
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("overwrite the existing value IN PLACE");
    expect(WORKSPACE_SYSTEM_PROMPT).toContain("Do not duplicate");
    expect(WORKSPACE_CHAT_SUFFIX).toContain("apply_edit or replace_lines");
    expect(WORKSPACE_CHAT_SUFFIX).toContain("add (insert new) from fill/replace");
    expect(WORKSPACE_CHAT_SUFFIX).toContain("never stack a new line next to an unreplaced old value");
  });
});
