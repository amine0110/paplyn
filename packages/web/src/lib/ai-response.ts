import type { GenerateTextResult, ToolSet } from "ai";
import type {
  AiAppliedAction,
  AiPaper,
  AiToolRead,
  AiUsedPlugin,
  LiteratureToolPayload,
} from "@/lib/ai-types";
import {
  isClientActionPayload,
  isClientActionRejectedPayload,
  type AiClientAction,
  type ClientActionToolPayload,
} from "@/lib/ai-client-actions";
import { CLIENT_ACTION_TOOL_NAMES } from "@/lib/ai-plugins/workspace-tools";
import type { ReadTexFileResult } from "@/lib/ai-plugins/workspace-tools";
import { getPluginByToolName, pluginDisplayName } from "@/lib/ai-plugins";
import type { AiPlugin } from "@/lib/ai-plugins/types";

const LITERATURE_TOOL_NAME = "search_literature";
const READ_ONLY_TOOL_NAMES = new Set(["get_file", "list_files"]);

export const NO_EDIT_FALLBACK_MESSAGE =
  "I looked through the project but didn't change any files. Try rephrasing your request or pointing me to the file and section.";

/** Tool call/result shapes for reading generateText output without a concrete ToolSet. */
type LooseToolCall = { toolName: string };
type LooseToolResult = { toolName: string; result: unknown };
type LooseGenerateTextResult = {
  toolCalls: LooseToolCall[];
  toolResults: LooseToolResult[];
  steps: Array<{
    toolCalls: LooseToolCall[];
    toolResults: LooseToolResult[];
  }>;
};

/** Avoid GenerateTextResult<ToolSet> collapsing toolResults to never[]. */
function asLooseGenerateTextResult<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): LooseGenerateTextResult {
  return result as unknown as LooseGenerateTextResult;
}

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

function isClientActionRejected(
  result: unknown
): result is { kind: "client-action-rejected"; reason: string } {
  return isClientActionRejectedPayload(result);
}

function isReadTexFileResult(result: unknown): result is ReadTexFileResult {
  return (
    typeof result === "object" &&
    result !== null &&
    typeof (result as ReadTexFileResult).path === "string" &&
    typeof (result as ReadTexFileResult).content === "string"
  );
}

function isListFilesResult(
  result: unknown
): result is { files: string[]; count: number; error: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    Array.isArray((result as { files?: unknown }).files) &&
    typeof (result as { count?: unknown }).count === "number"
  );
}

/** Short human label for one tool result (never raw JSON). */
export function summarizeToolResult(toolName: string, result: unknown): string | null {
  if (result == null) return null;

  if (isLiteratureToolPayload(result)) {
    const trimmed = result.summary.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (isClientActionPayload(result)) {
    return result.action.label;
  }

  if (isClientActionRejected(result)) {
    if (
      toolName === "apply_edit" ||
      toolName === "fix_compile_errors" ||
      toolName === "replace_lines"
    ) {
      const reason =
        typeof result.reason === "string" && result.reason.length > 0
          ? result.reason
          : "Couldn't apply edit";
      return reason.length > 120 ? `${reason.slice(0, 117)}…` : reason;
    }
    return "Couldn't complete editor action";
  }

  if (toolName === "get_file" && isReadTexFileResult(result)) {
    if (result.error) {
      return `Couldn't read ${result.path}`;
    }
    const lineRange =
      result.startLine === result.endLine
        ? `line ${result.startLine}`
        : `lines ${result.startLine}–${result.endLine}`;
    return `Read ${result.path} (${lineRange})`;
  }

  if (toolName === "list_files" && isListFilesResult(result)) {
    if (result.error) return "Couldn't list project files";
    return `Listed ${result.count} project file(s)`;
  }

  if (typeof result === "string") {
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
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
  return null;
}

function collectToolResultSummaries(
  result: LooseGenerateTextResult,
  options?: { includeReadOnly?: boolean }
): string[] {
  const includeReadOnly = options?.includeReadOnly ?? true;
  const summaries: string[] = [];

  for (const toolResult of result.toolResults) {
    if (!includeReadOnly && READ_ONLY_TOOL_NAMES.has(toolResult.toolName)) continue;
    const summary = summarizeToolResult(toolResult.toolName, toolResult.result);
    if (summary) summaries.push(summary);
  }

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      if (!includeReadOnly && READ_ONLY_TOOL_NAMES.has(toolResult.toolName)) continue;
      const summary = summarizeToolResult(toolResult.toolName, toolResult.result);
      if (summary) summaries.push(summary);
    }
  }

  return [...new Set(summaries)];
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
  const loose = asLooseGenerateTextResult(result);
  const summaries = collectToolResultSummaries(loose, { includeReadOnly: false });
  if (summaries.length === 0) return null;

  const literature = summaries.find((text) => text.includes("Found ") && text.includes("paper(s)"));
  if (literature) return literature;

  return summaries.join(". ");
}

export function formatAppliedActionsAsAssistantMessage(actions: AiClientAction[]): string | null {
  const labels = actions.map((action) => action.label).filter((label) => label.trim().length > 0);
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0]!;
  return labels.join("; ");
}

export function collectToolReadChips<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): AiToolRead[] {
  const loose = asLooseGenerateTextResult(result);
  const reads: AiToolRead[] = [];
  const seen = new Set<string>();

  for (const usage of collectToolUsages(loose)) {
    if (usage.toolName !== "get_file" || !usage.toolResult) continue;
    const summary = summarizeToolResult("get_file", usage.toolResult);
    if (!summary || seen.has(summary)) continue;
    seen.add(summary);
    const path = isReadTexFileResult(usage.toolResult) ? usage.toolResult.path : "file";
    reads.push({ label: summary, path });
  }

  return reads;
}

export function hadReadOnlyToolActivity<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): boolean {
  const loose = asLooseGenerateTextResult(result);
  const names = READ_ONLY_TOOL_NAMES;
  if (loose.toolCalls.some((call) => names.has(call.toolName))) return true;
  if (loose.toolResults.some((tr) => names.has(tr.toolName))) return true;
  return loose.steps.some(
    (step) =>
      step.toolCalls.some((call) => names.has(call.toolName)) ||
      step.toolResults.some((tr) => names.has(tr.toolName))
  );
}

export function resolveEmptyAssistantFallback<TOOLS extends ToolSet>(options: {
  result: GenerateTextResult<TOOLS, unknown>;
  actions: AiClientAction[];
}): string {
  const { result, actions } = options;

  if (!hadToolActivity(result)) {
    return "I couldn't generate a response. Please try again.";
  }

  const appliedSummary = formatAppliedActionsAsAssistantMessage(actions);
  if (appliedSummary) return appliedSummary;

  const fallback = formatToolResultsAsAssistantMessage(result);
  if (fallback) return fallback;

  if (usedClientEditTools(result)) {
    return "I applied the suggested edits. Recompile to check whether the errors are resolved.";
  }

  if (hadReadOnlyToolActivity(result)) {
    return NO_EDIT_FALLBACK_MESSAGE;
  }

  return "I searched but couldn't format the results. Please try asking again.";
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

function collectLiteraturePayloads(result: LooseGenerateTextResult): LiteratureToolPayload[] {
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

function collectToolUsages(result: LooseGenerateTextResult): { toolName: string; toolResult?: unknown }[] {
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

export function collectUsedPlugins<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>,
  plugins: AiPlugin[]
): AiUsedPlugin[] {
  const used = new Map<string, AiUsedPlugin>();

  for (const usage of collectToolUsages(asLooseGenerateTextResult(result))) {
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

export function collectPapersFromToolResults<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): AiPaper[] {
  const papers = collectLiteraturePayloads(asLooseGenerateTextResult(result)).flatMap(
    (payload) => payload.papers
  );
  return dedupePapers(papers);
}

function collectClientActionPayloads(result: LooseGenerateTextResult): ClientActionToolPayload[] {
  const payloads: ClientActionToolPayload[] = [];

  for (const toolResult of result.toolResults) {
    if (isClientActionPayload(toolResult.result)) {
      payloads.push(toolResult.result);
    }
  }

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      if (isClientActionPayload(toolResult.result)) {
        payloads.push(toolResult.result);
      }
    }
  }

  return payloads;
}

function clientActionDedupeKey(action: AiClientAction): string {
  switch (action.type) {
    case "replace_lines":
      return `replace_lines:${action.file}:${action.startLine}:${action.endLine}:${action.replace}`;
    case "apply_edit":
      return `apply_edit:${action.file}:${action.search}:${action.replace}`;
    case "fix_compile_errors":
      return `fix_compile_errors:${JSON.stringify(action.edits)}`;
    case "insert_at_cursor":
      return `insert_at_cursor:${action.text}`;
    case "replace_selection":
      return `replace_selection:${action.text}`;
    default:
      return JSON.stringify(action);
  }
}

export function collectClientActionsFromToolResults<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): AiClientAction[] {
  const actions: AiClientAction[] = [];
  const seen = new Set<string>();

  for (const payload of collectClientActionPayloads(asLooseGenerateTextResult(result))) {
    const key = clientActionDedupeKey(payload.action);
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(payload.action);
  }

  return actions;
}

export function toAppliedActionSummaries(actions: AiClientAction[]): AiAppliedAction[] {
  return actions.map((action) => ({
    label: action.label,
    type: action.type,
    file:
      action.type === "apply_edit" || action.type === "replace_lines"
        ? action.file
        : action.type === "fix_compile_errors"
          ? action.edits[0]?.file
          : undefined,
  }));
}

export function usedClientEditTools<TOOLS extends ToolSet>(
  result: GenerateTextResult<TOOLS, unknown>
): boolean {
  const loose = asLooseGenerateTextResult(result);
  const names = new Set<string>(CLIENT_ACTION_TOOL_NAMES);
  if (loose.toolCalls.some((call) => names.has(call.toolName))) return true;
  if (loose.toolResults.some((tr) => names.has(tr.toolName))) return true;
  return loose.steps.some(
    (step) =>
      step.toolCalls.some((call) => names.has(call.toolName)) ||
      step.toolResults.some((tr) => names.has(tr.toolName))
  );
}

export { isWhitespaceOnly };
