import type { AiAppliedAction, AiChatResponse, AiPaper, AiToolRead, AiUsedPlugin } from "@/lib/ai-types";
import type { AiClientAction } from "@/lib/ai-client-actions";

export const AI_STREAM_CONTENT_TYPE = "application/x-ndjson";

export type AiStreamProgressEvent = {
  type: "progress";
  message: string;
};

export type AiStreamDoneEvent = AiChatResponse & {
  type: "done";
};

export type AiStreamErrorEvent = {
  type: "error";
  error: string;
  status?: number;
  retryAfter?: number;
};

export type AiStreamEvent = AiStreamProgressEvent | AiStreamDoneEvent | AiStreamErrorEvent;

export function encodeAiStreamEvent(event: AiStreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export function parseAiStreamLine(line: string): AiStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as AiStreamEvent;
}

export async function consumeAiStream(
  response: Response,
  onProgress: (message: string) => void
): Promise<AiChatResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("ndjson")) {
    const data = (await response.json()) as AiChatResponse;
    return data;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lastDone: AiChatResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const event = parseAiStreamLine(line);
      if (!event) continue;

      if (event.type === "progress") {
        onProgress(event.message);
        continue;
      }

      if (event.type === "error") {
        const error = new Error(event.error) as Error & {
          status?: number;
          retryAfter?: number;
        };
        error.status = event.status;
        error.retryAfter = event.retryAfter;
        throw error;
      }

      if (event.type === "done") {
        lastDone = {
          content: event.content,
          ...(event.usedPlugins ? { usedPlugins: event.usedPlugins } : {}),
          ...(event.papers ? { papers: event.papers } : {}),
          ...(event.doiCitations ? { doiCitations: event.doiCitations } : {}),
          ...(event.arxivPapers ? { arxivPapers: event.arxivPapers } : {}),
          ...(event.zoteroItems ? { zoteroItems: event.zoteroItems } : {}),
          ...(event.actions ? { actions: event.actions } : {}),
          ...(event.appliedActions ? { appliedActions: event.appliedActions } : {}),
          ...(event.toolReads ? { toolReads: event.toolReads } : {}),
        };
      }
    }
  }

  const trailing = parseAiStreamLine(buffer);
  if (trailing) {
    if (trailing.type === "progress") onProgress(trailing.message);
    if (trailing.type === "error") throw new Error(trailing.error);
    if (trailing.type === "done") {
      lastDone = {
        content: trailing.content,
        ...(trailing.usedPlugins ? { usedPlugins: trailing.usedPlugins } : {}),
        ...(trailing.papers ? { papers: trailing.papers } : {}),
        ...(trailing.doiCitations ? { doiCitations: trailing.doiCitations } : {}),
        ...(trailing.arxivPapers ? { arxivPapers: trailing.arxivPapers } : {}),
        ...(trailing.zoteroItems ? { zoteroItems: trailing.zoteroItems } : {}),
        ...(trailing.actions ? { actions: trailing.actions } : {}),
        ...(trailing.appliedActions ? { appliedActions: trailing.appliedActions } : {}),
        ...(trailing.toolReads ? { toolReads: trailing.toolReads } : {}),
      };
    }
  }

  if (!lastDone) {
    throw new Error("Stream ended without a result");
  }

  return lastDone;
}

export function isAiStreamResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").includes("ndjson");
}

export type { AiAppliedAction, AiClientAction, AiPaper, AiToolRead, AiUsedPlugin };
