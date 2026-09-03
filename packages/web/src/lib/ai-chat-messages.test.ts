import { describe, expect, it } from "vitest";
import {
  toCoreMessages,
  validateApiChatImages,
  VISION_IMAGE_SUFFIX,
} from "@/lib/ai-chat-messages";

const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ai-chat-messages", () => {
  it("forwards image parts to the model message format", () => {
    const core = toCoreMessages([
      {
        role: "user",
        content: "insert the table from this image",
        images: [{ dataUrl: PNG_1X1, mimeType: "image/png" }],
      },
    ]);

    expect(core).toHaveLength(1);
    expect(core[0]?.role).toBe("user");
    expect(Array.isArray(core[0]?.content)).toBe(true);
    const parts = core[0]?.content as Array<{ type: string; text?: string; image?: string }>;
    expect(parts).toEqual(
      expect.arrayContaining([
        { type: "text", text: "insert the table from this image" },
        expect.objectContaining({ type: "image", image: expect.any(String), mimeType: "image/png" }),
      ])
    );
  });

  it("keeps text-only messages unchanged", () => {
    expect(toCoreMessages([{ role: "user", content: "hello" }])).toEqual([
      { role: "user", content: "hello" },
    ]);
  });

  it("validates image attachments on the API payload", () => {
    expect(
      validateApiChatImages([
        {
          role: "user",
          content: "see this",
          images: [{ dataUrl: PNG_1X1, mimeType: "image/png" }],
        },
      ])
    ).toBeNull();
  });

  it("includes vision guidance for image turns", () => {
    expect(VISION_IMAGE_SUFFIX).toMatch(/never invent/i);
    expect(VISION_IMAGE_SUFFIX).toMatch(/replace_lines|apply_edit/);
  });
});
