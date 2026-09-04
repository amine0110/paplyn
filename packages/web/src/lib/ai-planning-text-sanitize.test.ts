import { describe, expect, it } from "vitest";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  countFutureTensePlans,
  countMissingSpaceAfterPeriod,
  fixSentenceSpacing,
  formatAppliedActionsSummary,
  hasFutureTensePlanning,
  isMashedPlanningText,
  MASHED_PLANNING_SAMPLE,
  resolveAssistantBubbleContent,
  stripFutureTenseSentences,
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

const insertAction: AiClientAction = {
  type: "apply_edit",
  file: "template.tex",
  search: "\\end{abstract}",
  replace: "\\end{abstract}\n\\begin{table}...\\end{table}",
  label: "Inserted content after abstract in template.tex",
};

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
    expect(hasFutureTensePlanning(done)).toBe(false);
  });

  it("does not flag normal prose answers", () => {
    expect(
      isMashedPlanningText(
        "The abstract summarizes your contribution. I updated the affiliation on line 12."
      )
    ).toBe(false);
  });

  it("fixes missing spaces between mashed sentences", () => {
    expect(fixSentenceSpacing("Introduction.Found your project")).toBe(
      "Introduction. Found your project"
    );
  });

  it("strips future-tense planning but keeps past-tense context", () => {
    const mixed =
      "The table was sitting before the Introduction. I'll move it to right after the Introduction.";
    expect(stripFutureTenseSentences(mixed)).toBe(
      "The table was sitting before the Introduction."
    );
  });

  it("formats applied actions as bullets with Done", () => {
    expect(formatAppliedActionsSummary([insertAction])).toBe(
      "- Inserted content after abstract in template.tex\n\nDone."
    );
  });

  it("replaces mashed planning with structured applied-action summary", () => {
    const result = mockResult({
      toolResults: [
        {
          toolName: "apply_edit",
          result: { kind: "client-action", action: insertAction },
        },
      ],
    });

    expect(
      resolveAssistantBubbleContent({
        rawText: MASHED_PLANNING_SAMPLE,
        actions: [insertAction],
        result,
      })
    ).toBe("- Inserted content after abstract in template.tex\n\nDone.");
  });

  it("combines salvaged past-tense context with action bullets", () => {
    const raw =
      "The table landed before the Introduction. I'll move it to right after the Introduction.";
    const result = mockResult({
      toolResults: [
        {
          toolName: "apply_edit",
          result: { kind: "client-action", action: insertAction },
        },
      ],
    });

    expect(
      resolveAssistantBubbleContent({
        rawText: raw,
        actions: [insertAction],
        result,
      })
    ).toBe(
      "The table landed before the Introduction.\n\n- Inserted content after abstract in template.tex\n\nDone."
    );
  });

  it("keeps clean past-tense model text when it is not planning", () => {
    const clean =
      "The table was in the wrong place. I moved it after the Introduction in template.tex.";
    expect(
      resolveAssistantBubbleContent({
        rawText: clean,
        actions: [insertAction],
        result: mockResult(),
      })
    ).toBe(clean);
  });

  it("strips lone future-tense planning after edits without over-stripping to Done only", () => {
    const raw = "I'll insert the inference-speeds table after the Introduction.";
    expect(
      resolveAssistantBubbleContent({
        rawText: raw,
        actions: [insertAction],
        result: mockResult({
          toolResults: [
            {
              toolName: "apply_edit",
              result: { kind: "client-action", action: insertAction },
            },
          ],
        }),
      })
    ).toBe("- Inserted content after abstract in template.tex\n\nDone.");
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
