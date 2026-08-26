import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import {
  getForcedToolDisplayName,
  getForcedToolPrompt,
  isForcedToolCapabilityQuestion,
  isPluginToolName,
  PLUGIN_TOOL_NAMES,
  resolveForcedToolChoice,
} from "./forced-tool";

function stubPluginTools(): Record<(typeof PLUGIN_TOOL_NAMES)[number], Tool> {
  return Object.fromEntries(
    PLUGIN_TOOL_NAMES.map((name) => [name, {} as Tool])
  ) as Record<(typeof PLUGIN_TOOL_NAMES)[number], Tool>;
}

describe("forced-tool helpers", () => {
  it("exposes display names that match the composer menu", () => {
    expect(getForcedToolDisplayName("search_literature")).toBe("Semantic Scholar");
    expect(getForcedToolDisplayName("cite_from_doi")).toBe("Cite DOI / Crossref");
    expect(getForcedToolDisplayName("search_arxiv")).toBe("arXiv");
    expect(getForcedToolDisplayName("parse_github_repo")).toBe("GitHub");
  });

  it("scopes this tool to the attached plugin in the forced prompt", () => {
    const prompt = getForcedToolPrompt("search_literature");
    expect(prompt).toContain("Semantic Scholar");
    expect(prompt).toContain('When they say "this tool"');
    expect(prompt).toContain("not Paplyn AI workspace tools");
    expect(prompt).toContain("list_files");
    expect(prompt).toContain("search_literature");
    expect(prompt).toContain("what this tool can do");
    expect(getForcedToolPrompt("not-a-tool")).toBeUndefined();
  });

  it("detects capability questions about the attached tool", () => {
    expect(isForcedToolCapabilityQuestion("What can this tool do?")).toBe(true);
    expect(isForcedToolCapabilityQuestion("How does the tool work")).toBe(true);
    expect(isForcedToolCapabilityQuestion("search arxiv for diffusion models")).toBe(false);
  });

  it("requires plugin tool choice for actionable requests only", () => {
    const pluginTools = stubPluginTools();

    expect(
      resolveForcedToolChoice({
        forcedTool: "search_literature",
        userMessage: "Find papers on protein folding",
        pluginTools,
      })
    ).toBe("search_literature");

    expect(
      resolveForcedToolChoice({
        forcedTool: "search_literature",
        userMessage: "What can this tool do?",
        pluginTools,
      })
    ).toBeUndefined();

    expect(
      resolveForcedToolChoice({
        forcedTool: "not-a-tool",
        userMessage: "Find papers",
        pluginTools,
      })
    ).toBeUndefined();
  });

  it("narrows plugin tool names for streamText toolChoice", () => {
    const forced = "search_literature";
    expect(isPluginToolName(forced)).toBe(true);

    const tools = stubPluginTools();
    const choice = resolveForcedToolChoice({
      forcedTool: forced,
      userMessage: "cite related work on transformers",
      pluginTools: tools,
    });

    if (!choice) {
      throw new Error("expected a forced tool choice");
    }

    expect(choice in tools).toBe(true);
    expect(choice satisfies keyof typeof tools).toBe("search_literature");
  });

  it("forces arXiv after a literature search turn when the picker selects search_arxiv", () => {
    const pluginTools = stubPluginTools();

    expect(
      resolveForcedToolChoice({
        forcedTool: "search_arxiv",
        userMessage: "find more papers on protein folding",
        pluginTools,
      })
    ).toBe("search_arxiv");

    expect(getForcedToolPrompt("search_arxiv")).toContain("search_arxiv");
    expect(getForcedToolPrompt("search_arxiv")).not.toContain("search_literature");
  });
});
