import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

describe("PAP-43 working state deploy-gate", () => {
  it("shows pulsing progress chips immediately and through NDJSON progress", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    const working = readSrc("components/ai-working-progress.tsx");
    expect(sidebar).toContain("AiWorkingProgress");
    expect(sidebar).toContain("initialProgressSteps");
    expect(sidebar).toContain("pushProgressStep");
    expect(sidebar).toContain("consumeAiStream");
    expect(working).toContain('aria-live="polite"');
    expect(working).toContain("AI_PROGRESS_CHIP_ACTIVE");
    expect(sidebar).not.toContain("hasStreamProgress");
    expect(sidebar).not.toContain("setLoadingMessage");
  });

  it("defines progress chip pulse animation in globals.css", () => {
    const css = readSrc("app/globals.css");
    expect(css).toContain(".ai-progress-chip");
    expect(css).toContain(".ai-progress-chip-active");
    expect(css).toContain("@keyframes ai-progress-chip-pulse");
    expect(css).toContain(".ai-typing-dot");
    expect(css).toContain("@keyframes ai-typing-pulse");
  });

  it("exports stable progress chip class constants", () => {
    const chrome = readSrc("lib/chrome-interactive.ts");
    expect(chrome).toContain('export const AI_WORKING_PROGRESS = "ai-working-progress"');
    expect(chrome).toContain('export const AI_PROGRESS_CHIP = "ai-progress-chip"');
    expect(chrome).toContain('export const AI_PROGRESS_CHIP_ACTIVE = "ai-progress-chip-active"');
  });

  it("keeps mobile sheet working state visible above the composer", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toContain('variant === "sheet" && "sticky bottom-0 z-10 backdrop-blur-sm"');
    expect(sidebar).toContain("variant === \"sheet\" ? (");
    expect(sidebar).toContain("<AiWorkingProgress steps={progressSteps} compact />");
  });

  it("does not regress PAP-44 stop, PAP-49 images, or NDJSON stream wiring", () => {
    const sidebar = readSrc("components/ai-sidebar.tsx");
    expect(sidebar).toContain("abortControllerRef");
    expect(sidebar).toContain('aria-label="Stop generation"');
    expect(sidebar).toContain('aria-label="Attach image"');
    expect(sidebar).toContain("pendingImages");
    expect(sidebar).toContain("consumeAiStream(");
  });
});
