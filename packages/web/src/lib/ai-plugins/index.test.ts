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
    expect(plugins.length).toBeGreaterThanOrEqual(1);
    expect(plugins[0]?.id).toBe("semantic-scholar");
  });

  it("resolves enabled plugin tools for generateText", () => {
    const { plugins, tools, systemPrompt } = resolveAiPlugins();
    expect(plugins.some((p) => p.id === "semantic-scholar")).toBe(true);
    expect(tools.search_literature).toBeDefined();
    expect(systemPrompt).toContain("search_literature");
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
  });
});
