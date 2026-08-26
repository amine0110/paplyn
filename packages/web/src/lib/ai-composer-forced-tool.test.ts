import { describe, expect, it } from "vitest";
import { resolveComposerForcedTool } from "@/lib/ai-composer-forced-tool";

describe("resolveComposerForcedTool", () => {
  it("prefers an explicit forcedTool option over picker state", () => {
    expect(resolveComposerForcedTool("search_arxiv", "search_literature")).toBe("search_arxiv");
  });

  it("uses picker selection when no explicit forcedTool is passed", () => {
    expect(resolveComposerForcedTool(undefined, "search_arxiv")).toBe("search_arxiv");
  });

  it("returns undefined when neither option nor picker selection is set", () => {
    expect(resolveComposerForcedTool(undefined, null)).toBeUndefined();
    expect(resolveComposerForcedTool(undefined, undefined)).toBeUndefined();
  });

  it("switches from OpenAlex default literature to arXiv picker selection", () => {
    const afterOpenAlexTurn = resolveComposerForcedTool(undefined, "search_arxiv");
    expect(afterOpenAlexTurn).toBe("search_arxiv");
    expect(afterOpenAlexTurn).not.toBe("search_literature");
  });
});
