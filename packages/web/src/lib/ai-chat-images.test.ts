import { describe, expect, it } from "vitest";
import {
  AI_CHAT_MAX_IMAGE_BYTES,
  createChatImageId,
  estimateDataUrlBytes,
  isAcceptedChatImageMimeType,
  parseChatImageDataUrl,
  validateChatImageDataUrl,
} from "@/lib/ai-chat-images";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ai-chat-images", () => {
  it("accepts supported mime types", () => {
    expect(isAcceptedChatImageMimeType("image/png")).toBe(true);
    expect(isAcceptedChatImageMimeType("image/jpeg")).toBe(true);
    expect(isAcceptedChatImageMimeType("application/pdf")).toBe(false);
  });

  it("parses and validates data URLs", () => {
    const parsed = parseChatImageDataUrl(PNG_1X1);
    expect(parsed.mimeType).toBe("image/png");
    expect(parsed.base64.length).toBeGreaterThan(10);
    expect(() => validateChatImageDataUrl(PNG_1X1, "image/png")).not.toThrow();
  });

  it("rejects oversized images", () => {
    const hugeBase64 = "A".repeat(Math.ceil((AI_CHAT_MAX_IMAGE_BYTES * 4) / 3) + 8);
    const hugeDataUrl = `data:image/png;base64,${hugeBase64}`;
    expect(() => validateChatImageDataUrl(hugeDataUrl, "image/png")).toThrow(/too large/i);
    expect(estimateDataUrlBytes(hugeDataUrl)).toBeGreaterThan(AI_CHAT_MAX_IMAGE_BYTES);
  });

  it("creates stable image ids", () => {
    expect(createChatImageId()).toMatch(/^img-|^[0-9a-f-]{36}$/);
  });
});
