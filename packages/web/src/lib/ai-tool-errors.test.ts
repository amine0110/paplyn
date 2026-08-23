import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import {
  AI_RATE_LIMIT_MESSAGE,
  formatAiRequestError,
  isAiPromptTooLargeError,
  isAiRateLimitError,
  isPromptTooLargeMessage,
  isTpmOrRateLimitMessage,
  isUnknownToolCallError,
  PROMPT_TOO_LARGE_MESSAGE,
} from "./ai-tool-errors";

function apiError(message: string, statusCode: number): APICallError {
  return new APICallError({
    message,
    url: "https://api.groq.com/openai/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseHeaders: {},
    responseBody: "",
    isRetryable: false,
  });
}

describe("ai-tool-errors", () => {
  it("detects unknown tool validation errors", () => {
    const error = apiError(
      "Tool call validation failed: tool call validation failed: attempted to call tool 'get_file' which was not in request.tools",
      400
    );

    expect(isUnknownToolCallError(error)).toBe(true);
    expect(formatAiRequestError(error)).toContain("unavailable tool");
  });

  it("passes through other API errors", () => {
    const error = apiError("Upstream model unavailable", 503);

    expect(isUnknownToolCallError(error)).toBe(false);
    expect(formatAiRequestError(error)).toBe("Upstream model unavailable");
  });
});

describe("isTpmOrRateLimitMessage", () => {
  it("detects TPM and rate-limit wording", () => {
    expect(
      isTpmOrRateLimitMessage(
        "Rate limit reached for model llama-3.3-70b-versatile: limit 6000 TPM, used 5900, requested 500"
      )
    ).toBe(true);
    expect(isTpmOrRateLimitMessage("tokens per minute limit exceeded")).toBe(true);
    expect(isTpmOrRateLimitMessage("too many requests")).toBe(true);
  });
});

describe("isPromptTooLargeMessage", () => {
  it("detects genuine prompt or request size errors", () => {
    expect(isPromptTooLargeMessage("Request too large for model")).toBe(true);
    expect(isPromptTooLargeMessage("Prompt is too long for this model")).toBe(true);
    expect(isPromptTooLargeMessage("maximum context length is 8192 tokens")).toBe(true);
  });

  it("does not treat TPM or rate-limit text as prompt too large", () => {
    const groqTpm =
      "Rate limit reached for model `llama-3.3-70b-versatile` in organization: limit 6000, used 5800, requested 500. Please try again in 2s.";
    expect(isPromptTooLargeMessage(groqTpm)).toBe(false);
    expect(isTpmOrRateLimitMessage(groqTpm)).toBe(true);
  });
});

describe("isAiPromptTooLargeError", () => {
  it("treats HTTP 413 as prompt too large", () => {
    expect(isAiPromptTooLargeError(apiError("payload too large", 413))).toBe(true);
  });

  it("treats 429 prompt-size errors as prompt too large", () => {
    expect(isAiPromptTooLargeError(apiError("Request too large for model", 429))).toBe(true);
  });

  it("does not treat Groq TPM 429 as prompt too large", () => {
    const error = apiError(
      "Rate limit reached for model `llama-3.3-70b-versatile`: limit 6000 TPM, used 5800, requested 500. Please try again in 2s.",
      429
    );
    expect(isAiPromptTooLargeError(error)).toBe(false);
    expect(isAiRateLimitError(error)).toBe(true);
  });
});

describe("isAiRateLimitError", () => {
  it("classifies remaining 429s as rate limits", () => {
    const error = apiError("429 Too Many Requests", 429);
    expect(isAiRateLimitError(error)).toBe(true);
    expect(isAiPromptTooLargeError(error)).toBe(false);
  });

  it("does not classify non-429 errors as rate limits", () => {
    expect(isAiRateLimitError(apiError("service unavailable", 503))).toBe(false);
  });
});

describe("user-facing messages", () => {
  it("exports distinct prompt-too-large and rate-limit copy", () => {
    expect(PROMPT_TOO_LARGE_MESSAGE).toContain("project context is too large");
    expect(AI_RATE_LIMIT_MESSAGE).toContain("rate limit");
    expect(PROMPT_TOO_LARGE_MESSAGE).not.toBe(AI_RATE_LIMIT_MESSAGE);
  });
});
