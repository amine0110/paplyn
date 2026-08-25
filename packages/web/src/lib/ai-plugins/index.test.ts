import { describe, expect, it } from "vitest";
import {
  getEnabledAiPlugins,
  getPluginActionPrompt,
  listAiPlugins,
  resolveAiPlugins,
} from "./index";

describe("ai-plugins registry", () => {
  it("lists semantic scholar as the first plugin", () => {
    const plugins = listAiPlugins();
    expect(plugins.length).toBeGreaterThanOrEqual(4);
    expect(plugins[0]?.id).toBe("semantic-scholar");
    expect(plugins.some((p) => p.id === "cite-doi")).toBe(true);
    expect(plugins.some((p) => p.id === "arxiv")).toBe(true);
    expect(plugins.some((p) => p.id === "github-import")).toBe(true);
  });

  it("resolves enabled plugin tools for generateText", () => {
    const { plugins, tools, systemPrompt } = resolveAiPlugins();
    expect(plugins.some((p) => p.id === "semantic-scholar")).toBe(true);
    expect(tools.search_literature).toBeDefined();
    expect(tools.cite_from_doi).toBeDefined();
    expect(tools.search_arxiv).toBeDefined();
    expect(tools.parse_github_repo).toBeDefined();
    expect(systemPrompt).toContain("search_literature");
    expect(systemPrompt).toContain("cite_from_doi");
  });

  it("maps find-papers action to semantic scholar prompt", () => {
    const prompt = getPluginActionPrompt("find-papers");
    expect(prompt).toContain("search_literature");
  });

  it("returns undefined for unknown actions", () => {
    expect(getPluginActionPrompt("unknown-action")).toBeUndefined();
  });

  it("keeps disabled plugins out of the resolved set", () => {
    const enabled = getEnabledAiPlugins();
    expect(enabled.every((p) => p.enabled)).toBe(true);
  });

  it("exposes landing metadata for public integrations strip", () => {
    const plugin = listAiPlugins().find((p) => p.id === "semantic-scholar");
    expect(plugin?.landing?.href).toContain("semanticscholar.org");
    expect(plugin?.landing?.wordmark).toBe("Semantic Scholar");

    const crossref = listAiPlugins().find((p) => p.id === "cite-doi");
    expect(crossref?.landing?.wordmark).toBe("Crossref");

    const arxiv = listAiPlugins().find((p) => p.id === "arxiv");
    expect(arxiv?.landing?.wordmark).toBe("arXiv");

    const github = listAiPlugins().find((p) => p.id === "github-import");
    expect(github?.landing?.wordmark).toBe("GitHub");
  });
});
