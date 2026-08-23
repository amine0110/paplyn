import { APICallError } from "ai";
import { describe, expect, it } from "vitest";
import { formatAiRequestError, isUnknownToolCallError } from "./ai-tool-errors";

describe("ai-tool-errors", () => {
  it("detects unknown tool validation errors", () => {
    const error = new APICallError({
      message:
        "Tool call validation failed: tool call validation failed: attempted to call tool 'get_file' which was not in request.tools",
      url: "https://api.groq.com/openai/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 400,
      responseHeaders: {},
      responseBody: "",
      isRetryable: false,
    });

    expect(isUnknownToolCallError(error)).toBe(true);
    expect(formatAiRequestError(error)).toContain("unavailable tool");
  });

  it("passes through other API errors", () => {
    const error = new APICallError({
      message: "Upstream model unavailable",
      url: "https://api.groq.com/openai/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 503,
      responseHeaders: {},
      responseBody: "",
      isRetryable: false,
    });

    expect(isUnknownToolCallError(error)).toBe(false);
    expect(formatAiRequestError(error)).toBe("Upstream model unavailable");
  });
});
