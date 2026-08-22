import type { GenerateTextResult, ToolSet } from "ai";

const LITERATURE_TOOL_NAME = "search_literature";

function isWhitespaceOnly(text: string): boolean {
  return text.trim().length === 0;
}

function stringifyToolResult(result: unknown): string | null {
  if (result == null) return null;
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
