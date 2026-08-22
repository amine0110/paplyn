import { describe, it, expect } from "vitest";
import {
  OPENAI_DEFAULT_BASE_URL,
  OPENAI_DEFAULT_MODEL,
  XAI_DEFAULT_BASE_URL,
  XAI_DEFAULT_MODEL,
  aiNotConfiguredMessage,
  isOpenAiHostedBaseUrl,
  resolveHostedAiConfig,
  resolveSelfHostedAiConfig,
} from "@/lib/ai-config";

describe("resolveHostedAiConfig", () => {
  it("prefers XAI_API_KEY with xAI defaults", () => {
    expect(
      resolveHostedAiConfig({
        xaiApiKey: "xai-test-key",
        openaiApiKey: "sk-openai",
        openaiBaseUrl: OPENAI_DEFAULT_BASE_URL,
      })
    ).toEqual({
      apiKey: "xai-test-key",
      baseUrl: XAI_DEFAULT_BASE_URL,
      model: XAI_DEFAULT_MODEL,
    });
  });

  it("uses OPENAI_MODEL override with xAI key", () => {
    expect(
      resolveHostedAiConfig({
        xaiApiKey: "xai-test-key",
        openaiModel: "grok-custom",
      })
    ).toEqual({
      apiKey: "xai-test-key",
      baseUrl: XAI_DEFAULT_BASE_URL,
      model: "grok-custom",
    });
  });

  it("falls back to OPENAI_* when XAI_API_KEY is unset", () => {
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
    expect(resolveHostedAiConfig({ xaiApiKey: "  ", openaiApiKey: "" })).toBeNull();
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

  it("does not use XAI_API_KEY on self-hosted", () => {
    expect(
      resolveSelfHostedAiConfig(null, {
        xaiApiKey: "xai-only",
      })
    ).toBeNull();
  });
});

describe("isOpenAiHostedBaseUrl", () => {
  it("detects api.openai.com", () => {
    expect(isOpenAiHostedBaseUrl("https://api.openai.com/v1")).toBe(true);
    expect(isOpenAiHostedBaseUrl("https://api.x.ai/v1")).toBe(false);
  });
});

describe("aiNotConfiguredMessage", () => {
  it("mentions XAI_API_KEY for hosted", () => {
    expect(aiNotConfiguredMessage(false)).toContain("XAI_API_KEY");
  });

  it("mentions admin settings for self-hosted", () => {
    expect(aiNotConfiguredMessage(true)).toContain("Admin settings");
  });
});
