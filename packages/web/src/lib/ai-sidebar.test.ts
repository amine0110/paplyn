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
    expect(src).toContain("submitComposer");
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

  it("defines chat enter and typing animations in globals.css", () => {
    const css = readSource("app/globals.css");
    expect(css).toContain(".ai-message-enter");
    expect(css).toContain(".ai-typing-dot");
    expect(css).toContain("@keyframes ai-message-enter");
    expect(css).toContain("@keyframes ai-typing-pulse");
  });

  it("composer exposes a tools button and attaches a picked plugin to the next send", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("AiComposerToolPicker");
    expect(src).toContain("selectedTool");
    expect(src).toContain("selectedToolRef");
    expect(src).toContain("resolveComposerForcedTool");
    expect(src).toContain("forcedTool");
    expect(src).toContain("AiComposerToolChip");

    const picker = readSource("components/ai-composer-tool-picker.tsx");
    expect(picker).toContain('aria-label="Choose a tool"');
    expect(picker).toContain("listComposerToolMeta");
    expect(picker).toContain("AiPluginLogo");

    const meta = readSource("lib/ai-plugins/client-meta.ts");
    expect(meta).toContain("Semantic Scholar");
    expect(meta).toContain("Cite DOI / Crossref");
    expect(meta).toContain("search_arxiv");
    expect(meta).toContain("parse_github_repo");
  });

  it("shows arXiv Open paper and Cite actions instead of TeX import", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("Open paper");
    expect(src).toContain("onCiteArxivPaper");
    expect(src).toContain("openArxivPaper");
    expect(src).toContain('window.open(paper.sourceUrl, "_blank", "noopener,noreferrer")');
    expect(src).not.toContain("onImportArxiv");
    expect(src).not.toContain("Import from arXiv");
    expect(src).not.toContain("importSource");
    expect(src).not.toMatch(/>\s*TeX\s*</);
  });

  it("shows Stop during in-flight turns and wires AbortController to fetch", () => {
    const src = readSource("components/ai-sidebar.tsx");
    expect(src).toContain("abortControllerRef");
    expect(src).toContain("new AbortController()");
    expect(src).toContain("handleStopGeneration");
    expect(src).toContain('aria-label="Stop generation"');
    expect(src).toContain("CHROME_STOP_BTN");
    expect(src).toMatch(/loading \? \([\s\S]*Stop generation[\s\S]*\) : \([\s\S]*CHROME_SEND_BTN/s);
    expect(src).toContain("signal,");
    expect(src).toContain('error.name === "AbortError"');
    expect(src).toContain('"Stopped."');
    expect(src).toContain("consumeAiStream");
  });
});
