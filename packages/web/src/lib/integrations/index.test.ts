import { describe, expect, it } from "vitest";
import { resolveAiProviderLanding } from "@/lib/ai-config";
import { getLandingIntegrations } from "./index";

describe("getLandingIntegrations", () => {
  it("includes LaTeX core, AI provider, Ollama, and wired plugins", () => {
    const items = getLandingIntegrations({ isSelfHosted: false });
    const ids = items.map((item) => item.id);
    expect(ids).toContain("latex");
    expect(ids).toContain("ollama");
    expect(ids).toContain("semantic-scholar");
    expect(ids).toContain("cite-doi");
    expect(ids).toContain("arxiv");
    expect(ids).toContain("github-import");
    expect(ids).toContain("groq");
  });

  it("includes Ollama with OpenAI-compatible caption", () => {
    const ollama = getLandingIntegrations({ isSelfHosted: false }).find((item) => item.id === "ollama");
    expect(ollama?.name).toBe("Ollama");
    expect(ollama?.wordmark).toBe("Ollama");
    expect(ollama?.caption).toBe("OpenAI-compatible API");
    expect(ollama?.href).toBe("https://ollama.com");
  });

  it("derives Semantic Scholar landing from the plugin registry", () => {
    const s2 = getLandingIntegrations({ isSelfHosted: false }).find(
      (item) => item.id === "semantic-scholar"
    );
    expect(s2?.name).toBe("Semantic Scholar");
    expect(s2?.wordmark).toBe("Semantic Scholar");
    expect(s2?.href).toContain("semanticscholar.org");
  });

  it("shows OpenAI-compatible AI on self-hosted landing", () => {
    const items = getLandingIntegrations({ isSelfHosted: true });
    expect(items.some((item) => item.id === "openai-compatible")).toBe(true);
    expect(items.some((item) => item.id === "groq")).toBe(false);
    expect(items.some((item) => item.id === "ollama")).toBe(true);
  });

  it("never advertises xAI or Grok", () => {
    const items = getLandingIntegrations({ isSelfHosted: false });
    const labels = items.map((item) => `${item.name} ${item.wordmark}`.toLowerCase()).join(" ");
    expect(labels).not.toContain("grok");
    expect(labels).not.toContain("xai");
  });
});

describe("resolveAiProviderLanding", () => {
  it("maps Groq keys to Groq branding", () => {
    const item = resolveAiProviderLanding({
      isSelfHosted: false,
      env: { groqApiKey: "gsk-test" },
    });
    expect(item?.id).toBe("groq");
    expect(item?.wordmark).toBe("Groq");
  });

  it("maps BYO OpenAI keys to OpenAI branding", () => {
    const item = resolveAiProviderLanding({
      isSelfHosted: false,
      env: {
        openaiApiKey: "sk-openai",
        openaiBaseUrl: "https://api.openai.com/v1",
      },
    });
    expect(item?.id).toBe("openai");
    expect(item?.wordmark).toBe("OpenAI");
  });

  it("treats legacy gsk XAI_API_KEY as Groq, not xAI", () => {
    const item = resolveAiProviderLanding({
      isSelfHosted: false,
      env: { xaiApiKey: "gsk-legacy" },
    });
    expect(item?.id).toBe("groq");
    expect(item?.wordmark).not.toContain("Grok");
  });
});
