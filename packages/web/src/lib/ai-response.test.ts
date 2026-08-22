import { describe, expect, it } from "vitest";
import {
  collectToolResultTexts,
  formatToolResultsAsAssistantMessage,
  hadToolActivity,
  usedLiteratureSearch,
} from "./ai-response";

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

describe("ai-response helpers", () => {
  it("detects tool activity across steps", () => {
    const result = mockResult({
      steps: [{ toolCalls: [{ toolName: "search_literature" }], toolResults: [] }],
    });
    expect(hadToolActivity(result)).toBe(true);
  });

  it("collects string tool results", () => {
    const result = mockResult({
      toolResults: [{ toolName: "search_literature", result: "Found 2 paper(s) for query." }],
    });
    expect(collectToolResultTexts(result)).toEqual(["Found 2 paper(s) for query."]);
  });

  it("formats literature tool output as fallback assistant text", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "search_literature",
          result: "Found 3 paper(s) for \"transformers\" via live semantic-scholar search.",
        },
      ],
    });
    expect(formatToolResultsAsAssistantMessage(result)).toContain("Found 3 paper(s)");
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
});
