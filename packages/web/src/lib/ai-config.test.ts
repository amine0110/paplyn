import { describe, it, expect } from "vitest";
import {
  GROQ_DEFAULT_BASE_URL,
  GROQ_DEFAULT_MODEL,
  OPENAI_DEFAULT_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  aiNotConfiguredMessage,
  isOpenAiHostedBaseUrl,
  looksLikeGroqApiKey,
  resolveGroqApiKey,
  resolveHostedAiConfig,
  resolveSelfHostedAiConfig,
} from "@/lib/ai-config";

describe("looksLikeGroqApiKey", () => {
  it("detects gsk prefix", () => {
    expect(looksLikeGroqApiKey("gsk_test_key")).toBe(true);
    expect(looksLikeGroqApiKey("sk-openai")).toBe(false);
  });
});

describe("resolveGroqApiKey", () => {
  it("prefers GROQ_API_KEY", () => {
    expect(
      resolveGroqApiKey({
        groqApiKey: "gsk-primary",
        openaiApiKey: "gsk-fallback",
      })
    ).toBe("gsk-primary");
  });

  it("accepts gsk in XAI_API_KEY when GROQ_API_KEY unset", () => {
    expect(resolveGroqApiKey({ xaiApiKey: "gsk-from-xai" })).toBe("gsk-from-xai");
  });

  it("accepts gsk in OPENAI_API_KEY when GROQ_API_KEY unset", () => {
    expect(resolveGroqApiKey({ openaiApiKey: "gsk-from-openai" })).toBe("gsk-from-openai");
  });
});

describe("resolveHostedAiConfig", () => {
  it("uses GROQ_API_KEY with Groq defaults", () => {
    expect(
      resolveHostedAiConfig({
        groqApiKey: "gsk-test",
        openaiApiKey: "sk-openai",
        openaiBaseUrl: OPENAI_DEFAULT_BASE_URL,
      })
    ).toEqual({
      apiKey: "gsk-test",
      baseUrl: GROQ_DEFAULT_BASE_URL,
      model: GROQ_DEFAULT_MODEL,
    });
  });

  it("treats gsk XAI_API_KEY as Groq when GROQ_API_KEY unset", () => {
    expect(
      resolveHostedAiConfig({
        xaiApiKey: "gsk-legacy-slot",
      })
    ).toEqual({
      apiKey: "gsk-legacy-slot",
      baseUrl: GROQ_DEFAULT_BASE_URL,
      model: GROQ_DEFAULT_MODEL,
    });
  });

  it("uses OPENAI_MODEL override with Groq key", () => {
    expect(
      resolveHostedAiConfig({
        groqApiKey: "gsk-test",
        openaiModel: "llama-custom",
      })
    ).toEqual({
      apiKey: "gsk-test",
      baseUrl: GROQ_DEFAULT_BASE_URL,
      model: "llama-custom",
    });
  });

  it("falls back to OPENAI_* when no Groq key is configured", () => {
    expect(
      resolveHostedAiConfig({
        openaiApiKey: "sk-openai",
        openaiBaseUrl: OPENAI_DEFAULT_BASE_URL,
        openaiModel: "gpt-4o",
      })
    ).toEqual({
      apiKey: "sk-openai",
      baseUrl: OPENAI_DEFAULT_BASE_URL,
      model: "gpt-4o",
    });
  });

  it("supports BYO OpenAI-compatible base URL", () => {
    expect(
      resolveHostedAiConfig({
        openaiApiKey: "sk-byok",
        openaiBaseUrl: "https://proxy.example/v1",
      })
    ).toEqual({
      apiKey: "sk-byok",
      baseUrl: "https://proxy.example/v1",
      model: OPENAI_DEFAULT_MODEL,
    });
  });

  it("returns null when no keys are configured", () => {
    expect(resolveHostedAiConfig({})).toBeNull();
    expect(resolveHostedAiConfig({ groqApiKey: "  ", openaiApiKey: "" })).toBeNull();
  });
});

describe("resolveSelfHostedAiConfig", () => {
  it("uses org settings when present", () => {
    expect(
      resolveSelfHostedAiConfig(
        {
          openaiApiKey: "org-key",
          openaiBaseUrl: "https://custom.example/v1",
          openaiModel: "org-model",
        },
        { openaiApiKey: "env-key" }
      )
    ).toEqual({
      apiKey: "org-key",
      baseUrl: "https://custom.example/v1",
      model: "org-model",
    });
  });

  it("falls back to OPENAI_* env when org key is missing", () => {
    expect(
      resolveSelfHostedAiConfig(null, {
        openaiApiKey: "env-key",
        openaiBaseUrl: OPENAI_DEFAULT_BASE_URL,
        openaiModel: "gpt-4o-mini",
      })
    ).toEqual({
      apiKey: "env-key",
      baseUrl: OPENAI_DEFAULT_BASE_URL,
      model: "gpt-4o-mini",
    });
  });

  it("does not use GROQ_API_KEY on self-hosted", () => {
    expect(
      resolveSelfHostedAiConfig(null, {
        groqApiKey: "gsk-only",
      })
    ).toBeNull();
  });
});

describe("isOpenAiHostedBaseUrl", () => {
  it("detects api.openai.com", () => {
    expect(isOpenAiHostedBaseUrl("https://api.openai.com/v1")).toBe(true);
    expect(isOpenAiHostedBaseUrl("https://api.groq.com/openai/v1")).toBe(false);
  });
});

describe("aiNotConfiguredMessage", () => {
  it("mentions GROQ_API_KEY for hosted", () => {
    expect(aiNotConfiguredMessage(false)).toContain("GROQ_API_KEY");
  });

  it("mentions admin settings for self-hosted", () => {
    expect(aiNotConfiguredMessage(true)).toContain("Admin settings");
  });
});
