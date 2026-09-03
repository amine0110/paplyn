import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateNoDummyManuscriptContent } from "@/lib/ai-compile-fix-validation";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-49 chat image attach and vision", () => {
  it("composer exposes image attach, paste, thumbnails, and remove", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toContain('aria-label="Attach image"');
    expect(sidebar).toContain("AI_CHAT_IMAGE_ACCEPT");
    expect(sidebar).toContain("handleComposerPaste");
    expect(sidebar).toContain("getClipboardImageFiles");
    expect(sidebar).toContain("ChatImageThumbnails");
    expect(sidebar).toContain("removePendingImage");
    expect(sidebar).toContain("pendingImages");
    expect(sidebar).toContain("msg.images");
    expect(sidebar).not.toContain('aria-label="Attach file"');
  });

  it("keeps the + tool picker separate from image attach", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toContain("AiComposerToolPicker");
    expect(sidebar).toContain("ImagePlus");
    const picker = readSrc("components/ai-composer-tool-picker.tsx");
    expect(picker).toContain('aria-label="Choose a tool"');
    expect(picker).not.toContain("image/png");
  });

  it("API route accepts images and forwards multimodal messages to streamText", () => {
    const route = readSrc("app/api/projects/[id]/ai/route.ts");
    const messages = readSrc("lib/ai-chat-messages.ts");
    expect(route).toContain("images: z.array(aiChatImageSchema).optional()");
    expect(route).toContain("validateApiChatImages");
    expect(route).toContain("toCoreMessages");
    expect(route).toContain("VISION_IMAGE_SUFFIX");
    expect(messages).toContain('type: "image"');
  });

  it("thread persistence type includes images for PAP-28 hide-not-reset", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toMatch(/images\?: AiChatImage\[\]/);
    const thread = readSrc("lib/use-project-ai-chat-thread.ts");
    expect(thread).toContain("AiChatMessage");
  });

  it("PAP-39 dummy-table guard remains active", () => {
    const result = validateNoDummyManuscriptContent({
      replace: "\\begin{table}\\caption{x}\\end{table}",
      originalLines: [""],
    });
    expect(result.ok).toBe(false);
  });
});
