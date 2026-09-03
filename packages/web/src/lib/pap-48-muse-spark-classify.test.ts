import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isMuseSparkModel } from "@/lib/ai-classify-config";
import { classifyCompileDiagnosticsReview } from "@/lib/ai-compile-diagnostics-intent";
import { detectReferencesRecoveryIntent } from "@/lib/ai-compile-fix-bibliography-recovery";
import { classifyAiIntent, classifyAiIntentFallback, toolsForIntent } from "@/lib/ai-intent";
import { CLIENT_ACTION_TOOL_NAMES } from "@/lib/ai-plugins/workspace-tools";
import { formatAiStreamError } from "@/lib/ai-tool-errors";

const ROOT = join(import.meta.dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const mockModel = { modelId: "test-model" } as never;

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: vi.fn(),
  };
});

import { generateObject } from "ai";

describe("PAP-48 muse-spark classify guards", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
  });

  it("detects muse-spark model ids", () => {
    expect(isMuseSparkModel("muse-spark-1.3")).toBe(true);
    expect(isMuseSparkModel("meta/muse-spark-1.3")).toBe(true);
    expect(isMuseSparkModel("spark-1.0-preview")).toBe(true);
    expect(isMuseSparkModel("llama-3.3-70b-versatile")).toBe(false);
    expect(isMuseSparkModel("qwen2.5:7b")).toBe(false);
  });

  it("skips LLM classify for muse-spark-1.3 diagnostics review", async () => {
    await expect(
      classifyCompileDiagnosticsReview({
        message: "check the log",
        model: mockModel,
        modelId: "muse-spark-1.3",
      })
    ).resolves.toBe(true);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("skips LLM classify for muse-spark-1.3 intent", async () => {
    await expect(
      classifyAiIntent({
        message: "Find papers on transformers",
        model: mockModel,
        modelId: "muse-spark-1.3",
      })
    ).resolves.toBe("literature");
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("falls back when diagnostics classify times out", async () => {
    vi.mocked(generateObject).mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(
      classifyCompileDiagnosticsReview({
        message: "why is the PDF failing",
        model: mockModel,
        modelId: "llama-3.3-70b-versatile",
      })
    ).resolves.toBe(true);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
      })
    );
  });

  it("falls back when intent classify times out", async () => {
    vi.mocked(generateObject).mockRejectedValue(
      new DOMException("The operation was aborted due to timeout", "TimeoutError")
    );

    await expect(
      classifyAiIntent({
        message: "Find papers on transformers",
        model: mockModel,
        modelId: "llama-3.3-70b-versatile",
      })
    ).resolves.toBe("literature");
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        abortSignal: expect.any(AbortSignal),
      })
    );
  });

  it("still detects fix-the-references phrasing via regex fallback path", () => {
    expect(detectReferencesRecoveryIntent("fix the references")).toBe(true);
  });

  it("classifies PAP-48 references why-questions as edit on muse-spark regex path", async () => {
    const phrases = [
      "why does the references section is at the beginning of the article",
      "the references are at the beginning",
      "can you fix this",
      "do the fix and recompile after that",
    ];
    for (const message of phrases) {
      await expect(
        classifyAiIntent({
          message,
          model: mockModel,
          modelId: "muse-spark-1.3",
        })
      ).resolves.toBe("edit");
      expect(classifyAiIntentFallback({ message })).toBe("edit");
    }
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("mounts write tools for muse-spark references recovery intent", () => {
    const allWorkspaceTools = Object.fromEntries(
      ["list_files", "get_file", "replace_lines", "apply_edit"].map((name) => [name, {}])
    );
    const tools = toolsForIntent("edit", {}, allWorkspaceTools);
    for (const name of CLIENT_ACTION_TOOL_NAMES) {
      if (name in allWorkspaceTools) {
        expect(name in tools).toBe(true);
      }
    }
  });

  it("formats provider errors without leaking secrets", () => {
    const error = new APICallError({
      message: "Invalid API key sk-supersecretkey123456789",
      url: "https://api.meta.ai/v1/chat/completions",
      requestBodyValues: {},
      statusCode: 401,
      responseHeaders: {},
      responseBody: "",
      isRetryable: false,
    });

    const formatted = formatAiStreamError(error);
    expect(formatted.status).toBe(401);
    expect(formatted.error).toContain("401");
    expect(formatted.error).not.toContain("sk-supersecret");
    expect(formatted.error).not.toMatch(/at\s+\S+\s+\(/);
  });
});

describe("PAP-48 ai route streaming", () => {
  it("opens SSE before classify calls and emits Starting progress", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    const streamIndex = routeSrc.indexOf("new ReadableStream");
    const startingIndex = routeSrc.indexOf('emitProgress("Starting…")');
    const classifyIndex = routeSrc.indexOf("classifyCompileDiagnosticsReview({");
    const responseIndex = routeSrc.indexOf("return new Response(stream");

    expect(streamIndex).toBeGreaterThan(-1);
    expect(startingIndex).toBeGreaterThan(streamIndex);
    expect(classifyIndex).toBeGreaterThan(startingIndex);
    expect(responseIndex).toBeGreaterThan(streamIndex);
    expect(routeSrc).toContain("modelId");
    expect(routeSrc).toContain("formatAiStreamError");
  });

  it("does not hard-stop when references recovery intent finds no structural fix", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).not.toContain("Checking for misplaced references…");
    expect(routeSrc).toContain("referencesRecoveryIntent");
    expect(routeSrc).toContain('aiIntent = "edit"');
    expect(routeSrc).toContain("REFERENCES_RECOVERY_SUFFIX");
  });

  it("bans edit-unavailable and permission-ask copy in prompts", () => {
    const workspaceSrc = readSrc("lib/ai-plugins/workspace-tools.ts");
    expect(workspaceSrc).toMatch(/do not ask.*do you want me to move it/i);
    expect(workspaceSrc).toMatch(/edit tool is unavailable/i);
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).not.toMatch(/edit tool isn't available in this session/i);
  });

  it("still streams via streamText for non-muse models (groq/ollama)", () => {
    const routeSrc = readSrc("app/api/projects/[id]/ai/route.ts");
    expect(routeSrc).toContain("streamText({");
    expect(routeSrc).toContain("AI_STREAM_CONTENT_TYPE");
    expect(routeSrc).toContain("modelId");
    expect(routeSrc).toMatch(/openai\(aiConfig\.model\)/);
  });
});
