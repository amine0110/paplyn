import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("AI sidebar chat UX", () => {
  it("composer sends on Enter and keeps Shift+Enter for newlines", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("handleComposerKeyDown");
    expect(src).toMatch(/e\.key === "Enter" && !e\.shiftKey/);
    expect(src).toMatch(/void sendMessage\(input\)/);
    expect(src).toContain("textarea");
    expect(src).not.toContain("<Input");
  });

  it("pendingRequest still auto-sends via sendMessage", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("pendingRequest");
    expect(src).toMatch(
      /void sendMessage\(pendingRequest\.message, pendingRequest\.action/
    );
    expect(src).toContain("onPendingRequestConsumed");
  });

  it("keeps consumeAiStream for NDJSON progress", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("consumeAiStream");
    expect(src).toContain("setHasStreamProgress(true)");
  });

  it("shows tool read chips separately from the assistant message bubble", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("ToolReadChip");
    expect(src).toContain("toolReads");
  });

  it("composer has a tools button and passes forcedTool when a plugin is attached", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("Attach tool");
    expect(src).toContain("listComposerToolOptions");
    expect(src).toContain("selectedComposerTool");
    expect(src).toContain("forcedTool: attachedToolName");
    expect(src).toContain("handleSelectComposerTool");
    expect(src).toMatch(/Plus className/);
  });

  it("defines chat enter and typing animations in globals.css", () => {
    const css = readSource("app/globals.css");
    expect(css).toContain(".ai-message-enter");
    expect(css).toContain(".ai-typing-dot");
    expect(css).toContain("@keyframes ai-message-enter");
    expect(css).toContain("@keyframes ai-typing-pulse");
  });
});
