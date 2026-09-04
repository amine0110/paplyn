import { describe, expect, it } from "vitest";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  countFutureTensePlans,
  countMissingSpaceAfterPeriod,
  isMashedPlanningText,
  MASHED_PLANNING_SAMPLE,
  resolveAssistantBubbleContent,
} from "./ai-planning-text-sanitize";

function mockResult(overrides: Record<string, unknown> = {}) {
  return {
    text: "",
    toolCalls: [],
    toolResults: [],
    steps: [],
    response: { messages: [] },
    ...overrides,
  } as Parameters<typeof resolveAssistantBubbleContent>[0]["result"];
}

describe("ai-planning-text-sanitize", () => {
  it("detects the PAP-52 mashed planning sample", () => {
    expect(isMashedPlanningText(MASHED_PLANNING_SAMPLE)).toBe(true);
    expect(countFutureTensePlans(MASHED_PLANNING_SAMPLE)).toBeGreaterThanOrEqual(7);
    expect(countMissingSpaceAfterPeriod(MASHED_PLANNING_SAMPLE)).toBeGreaterThanOrEqual(3);
  });

  it("does not flag a short past-tense done sentence", () => {
    const done =
      "Inserted the inference-speeds table after the Introduction in template.tex.";
    expect(isMashedPlanningText(done)).toBe(false);
  });

  it("does not flag normal prose answers", () => {
    expect(
      isMashedPlanningText(
        "The abstract summarizes your contribution. I updated the affiliation on line 12."
      )
    ).toBe(false);
  });

  it("replaces mashed planning with applied action labels", () => {
    const action: AiClientAction = {
      type: "apply_edit",
      file: "template.tex",
      search: "\\end{abstract}",
      replace: "\\end{abstract}\n\\begin{table}...\\end{table}",
      label: "Inserted content after abstract in template.tex",
    };
    const result = mockResult({
      toolResults: [
        {
          toolName: "apply_edit",
          result: { kind: "client-action", action },
        },
      ],
    });

    expect(
      resolveAssistantBubbleContent({
        rawText: MASHED_PLANNING_SAMPLE,
        actions: [action],
        result,
      })
    ).toBe("Inserted content after abstract in template.tex");
  });

  it("keeps clean model text when it is not mashed planning", () => {
    const clean = "Inserted the table after the Introduction in template.tex.";
    expect(
      resolveAssistantBubbleContent({
        rawText: clean,
        actions: [],
        result: mockResult(),
      })
    ).toBe(clean);
  });

  it("falls back to tool summaries when mashed but no client actions", () => {
    const literatureSummary = 'Found 3 paper(s) for "transformers" via live semantic-scholar search.';
    const result = mockResult({
      toolResults: [
        {
          toolName: "search_literature",
          result: {
            kind: "literature-search",
            summary: literatureSummary,
            query: "transformers",
            source: "semantic-scholar",
            papers: [],
          },
        },
      ],
    });

    expect(
      resolveAssistantBubbleContent({
        rawText: "I'll search the literature.I'll summarize what I find.I'll list the top papers.",
        actions: [],
        result,
      })
    ).toBe(literatureSummary);
  });
});
