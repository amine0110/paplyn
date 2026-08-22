import type { GenerateTextResult, ToolSet } from "ai";
import type { AiPaper, AiUsedPlugin, LiteratureToolPayload } from "@/lib/ai-types";
import { getPluginByToolName, pluginDisplayName } from "@/lib/ai-plugins";
import type { AiPlugin } from "@/lib/ai-plugins/types";

const LITERATURE_TOOL_NAME = "search_literature";

function isWhitespaceOnly(text: string): boolean {
  return text.trim().length === 0;
}

function isLiteratureToolPayload(result: unknown): result is LiteratureToolPayload {
  return (
    typeof result === "object" &&
    result !== null &&
    (result as LiteratureToolPayload).kind === "literature-search"
  );
}

function stringifyToolResult(result: unknown): string | null {
  if (result == null) return null;
  if (isLiteratureToolPayload(result)) {
    const trimmed = result.summary.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof result === "string") {
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  try {
    const serialized = JSON.stringify(result);
    return serialized && serialized !== "{}" ? serialized : null;
  } catch {
    return null;
  }
}

/** Collect non-empty tool result strings from a generateText result (all steps). */
export function collectToolResultTexts<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): string[] {
  const texts: string[] = [];

  for (const toolResult of result.toolResults) {
    const text = stringifyToolResult(toolResult.result);
    if (text) texts.push(text);
  }

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      const text = stringifyToolResult(toolResult.result);
      if (text) texts.push(text);
    }
  }

  return [...new Set(texts)];
}

/** Fallback assistant text when the model returns empty text after tool calls. */
export function formatToolResultsAsAssistantMessage<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): string | null {
  const texts = collectToolResultTexts(result);
  if (texts.length === 0) return null;

  const literature = texts.find((text) => text.includes("Found ") && text.includes("paper(s)"));
  if (literature) return literature;

  return texts.join("\n\n");
}

export function hadToolActivity<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): boolean {
  if (result.toolCalls.length > 0 || result.toolResults.length > 0) return true;
  return result.steps.some(
    (step) => step.toolCalls.length > 0 || step.toolResults.length > 0
  );
}

export function usedLiteratureSearch<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): boolean {
  if (result.toolCalls.some((call) => call.toolName === LITERATURE_TOOL_NAME)) return true;
  if (result.toolResults.some((tr) => tr.toolName === LITERATURE_TOOL_NAME)) return true;
  return result.steps.some(
    (step) =>
      step.toolCalls.some((call) => call.toolName === LITERATURE_TOOL_NAME) ||
      step.toolResults.some((tr) => tr.toolName === LITERATURE_TOOL_NAME)
  );
}

function paperKey(paper: AiPaper): string {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
  return `title:${paper.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function dedupePapers(papers: AiPaper[]): AiPaper[] {
  const seen = new Set<string>();
  const unique: AiPaper[] = [];
  for (const paper of papers) {
    const key = paperKey(paper);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(paper);
  }
  return unique;
}

function collectLiteraturePayloads(result: GenerateTextResult<ToolSet, unknown>): LiteratureToolPayload[] {
  const payloads: LiteratureToolPayload[] = [];

  for (const toolResult of result.toolResults) {
    if (isLiteratureToolPayload(toolResult.result)) {
      payloads.push(toolResult.result);
    }
  }

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      if (isLiteratureToolPayload(toolResult.result)) {
        payloads.push(toolResult.result);
      }
    }
  }

  return payloads;
}

function sourceFromToolResult(result: unknown): AiUsedPlugin["source"] | undefined {
  if (!isLiteratureToolPayload(result)) return undefined;
  return result.source;
}

function collectToolUsages(
  result: GenerateTextResult<ToolSet, unknown>
): { toolName: string; toolResult?: unknown }[] {
  const usages: { toolName: string; toolResult?: unknown }[] = [];

  for (const call of result.toolCalls) {
    usages.push({ toolName: call.toolName });
  }
  for (const toolResult of result.toolResults) {
    usages.push({ toolName: toolResult.toolName, toolResult: toolResult.result });
  }
  for (const step of result.steps) {
    for (const call of step.toolCalls) {
      usages.push({ toolName: call.toolName });
    }
    for (const toolResult of step.toolResults) {
      usages.push({ toolName: toolResult.toolName, toolResult: toolResult.result });
    }
  }

  return usages;
}

export function collectUsedPlugins(
  result: GenerateTextResult<ToolSet, unknown>,
  plugins: AiPlugin[]
): AiUsedPlugin[] {
  const used = new Map<string, AiUsedPlugin>();

  for (const usage of collectToolUsages(result)) {
    const plugin = plugins.find((entry) => entry.toolName === usage.toolName) ?? getPluginByToolName(usage.toolName);
    if (!plugin) continue;

    const source = sourceFromToolResult(usage.toolResult);
    used.set(plugin.id, {
      id: plugin.id,
      displayName: pluginDisplayName(plugin, { source }),
      toolName: plugin.toolName,
      source,
    });
  }

  return [...used.values()];
}

export function collectPapersFromToolResults(
  result: GenerateTextResult<ToolSet, unknown>
): AiPaper[] {
  const papers = collectLiteraturePayloads(result).flatMap((payload) => payload.papers);
  return dedupePapers(papers);
}

export { isWhitespaceOnly };
