/** Shared types and validation for assistant chat image attachments (PAP-49). */

import { readFileAsDataUrl } from "@/lib/project-files";

export const AI_CHAT_ACCEPTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AiChatImageMimeType = (typeof AI_CHAT_ACCEPTED_IMAGE_MIME_TYPES)[number];

export const AI_CHAT_IMAGE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";

/** Max decoded image size per attachment. */
export const AI_CHAT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Max width or height in pixels. */
export const AI_CHAT_MAX_IMAGE_DIMENSION = 2048;

/** Max images per user message. */
export const AI_CHAT_MAX_IMAGES_PER_MESSAGE = 4;

export interface AiChatImage {
  dataUrl: string;
  mimeType: AiChatImageMimeType;
  name?: string;
}

export interface AiChatDraftImage extends AiChatImage {
  id: string;
}

export function isAcceptedChatImageMimeType(
  mimeType: string
): mimeType is AiChatImageMimeType {
  return (AI_CHAT_ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatChatImageSizeLimit(): string {
  return "5 MB";
}

export function createChatImageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseChatImageDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) {
    throw new Error("Invalid image data.");
  }

  const base64Marker = ";base64,";
  const markerIndex = trimmed.indexOf(base64Marker);
  if (markerIndex < 0) {
    throw new Error("Invalid image data.");
  }

  const mimeType = trimmed.slice("data:".length, markerIndex);
  const base64 = trimmed.slice(markerIndex + base64Marker.length);
  if (!mimeType || !base64) {
    throw new Error("Invalid image data.");
  }

  return { mimeType, base64 };
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const { base64 } = parseChatImageDataUrl(dataUrl);
  return Math.floor((base64.length * 3) / 4);
}

export function validateChatImageDataUrl(dataUrl: string, mimeType?: string): void {
  const parsed = parseChatImageDataUrl(dataUrl);
  const resolvedMime = mimeType ?? parsed.mimeType;
  if (!isAcceptedChatImageMimeType(resolvedMime)) {
    throw new Error("Only PNG, JPEG, WebP, and GIF images are supported.");
  }
  const bytes = estimateDataUrlBytes(dataUrl);
  if (bytes > AI_CHAT_MAX_IMAGE_BYTES) {
    throw new Error(`Image is too large (max ${formatChatImageSizeLimit()}).`);
  }
}

export function measureChatImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = dataUrl;
  });
}

export async function prepareChatImageFromFile(file: File): Promise<AiChatImage> {
  if (!isAcceptedChatImageMimeType(file.type)) {
    throw new Error("Only PNG, JPEG, WebP, and GIF images are supported.");
  }
  if (file.size > AI_CHAT_MAX_IMAGE_BYTES) {
    throw new Error(`Image is too large (max ${formatChatImageSizeLimit()}).`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  validateChatImageDataUrl(dataUrl, file.type);

  const { width, height } = await measureChatImageDimensions(dataUrl);
  if (width > AI_CHAT_MAX_IMAGE_DIMENSION || height > AI_CHAT_MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Image dimensions must be at most ${AI_CHAT_MAX_IMAGE_DIMENSION}px on each side.`
    );
  }

  return {
    dataUrl,
    mimeType: file.type,
    name: file.name || undefined,
  };
}

export function getClipboardImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of dataTransfer.items) {
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}
