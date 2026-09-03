import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-44 stop button deploy-gate", () => {
  it("wires AbortController through ai-sidebar fetch and consumeAiStream", () => {
    const sidebarSrc = readSrc("components/ai-sidebar.tsx");
    expect(sidebarSrc).toContain("abortControllerRef");
    expect(sidebarSrc).toContain("new AbortController()");
    expect(sidebarSrc).toContain("handleStopGeneration");
    expect(sidebarSrc).toContain("signal,");
    expect(sidebarSrc).toContain("consumeAiStream(");

    const streamSrc = readSrc("lib/ai-stream.ts");
    expect(streamSrc).toContain("signal?: AbortSignal");
    expect(streamSrc).toContain("AbortError");
  });

  it("closes the AI route stream when the client disconnects", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("abortSignal: req.signal");
    expect(routeSrc).toContain('req.signal.addEventListener("abort", close');
    expect(routeSrc).toContain("if (req.signal.aborted) return");
  });

  it("uses a distinct stop control style that stays visible on mobile", () => {
    const sidebarSrc = readSrc("components/ai-sidebar.tsx");
    expect(sidebarSrc).toContain("CHROME_STOP_BTN");
    expect(sidebarSrc).toContain('aria-label="Stop generation"');
    expect(sidebarSrc).toContain("shrink-0");

    const css = readSrc("app/globals.css");
    expect(css).toContain(".chrome-stop-btn");
  });
});
