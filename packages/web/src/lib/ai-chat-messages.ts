import type { CoreMessage, ImagePart, TextPart } from "ai";
import {
  AI_CHAT_MAX_IMAGES_PER_MESSAGE,
  parseChatImageDataUrl,
  validateChatImageDataUrl,
  type AiChatImage,
} from "@/lib/ai-chat-images";

export interface ApiChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: AiChatImage[];
}

export const VISION_IMAGE_SUFFIX = `The user attached image(s). Read tables, figures, and text in the images carefully. When they ask to insert content from an image, use replace_lines or apply_edit to add real LaTeX that matches what you see — never invent placeholder tables, dummy numbers, or fabricated data. If an image is too blurry or unreadable to transcribe accurately, say so instead of guessing. Infer intent and act on clear insert/replace requests without asking the user to rephrase.`;

export function messageHasImages(message: ApiChatMessage): boolean {
  return Boolean(message.images && message.images.length > 0);
}

export function requestHasImages(messages: ApiChatMessage[]): boolean {
  return messages.some((message) => message.role === "user" && messageHasImages(message));
}

export function validateApiChatImages(messages: ApiChatMessage[]): string | null {
  for (const message of messages) {
    const images = message.images ?? [];
    if (images.length > AI_CHAT_MAX_IMAGES_PER_MESSAGE) {
      return `You can attach up to ${AI_CHAT_MAX_IMAGES_PER_MESSAGE} images per message.`;
    }
    for (const image of images) {
      try {
        validateChatImageDataUrl(image.dataUrl, image.mimeType);
      } catch (error) {
        return error instanceof Error ? error.message : "Invalid image attachment.";
      }
    }
  }
  return null;
}

export function toCoreMessages(messages: ApiChatMessage[]): CoreMessage[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    const images = message.images ?? [];
    if (images.length === 0) {
      return { role: "user", content: message.content };
    }

    const parts: Array<TextPart | ImagePart> = [];
    if (message.content.trim()) {
      parts.push({ type: "text", text: message.content });
    }

    for (const image of images) {
      const parsed = parseChatImageDataUrl(image.dataUrl);
      parts.push({
        type: "image",
        image: parsed.base64,
        mimeType: image.mimeType ?? parsed.mimeType,
      });
    }

    return { role: "user", content: parts };
  });
}

export function estimateApiMessagesChars(messages: ApiChatMessage[]): number {
  return messages.reduce((sum, message) => {
    const imageChars = (message.images ?? []).reduce(
      (imageSum, image) => imageSum + image.dataUrl.length,
      0
    );
    return sum + message.content.length + imageChars;
  }, 0);
}
