import type { GenerateTextResult, ToolSet } from "ai";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  formatAppliedActionsAsAssistantMessage,
  formatToolResultsAsAssistantMessage,
  usedClientEditTools,
} from "@/lib/ai-response";

/** Sample from PAP-52 screenshot: concatenated future-tense planning without spaces. */
export const MASHED_PLANNING_SAMPLE =
  "Transcribing your inference speeds table — I'll place it right after the Introduction.Found your project file — now I'll locate the Introduction to position the table.I see where that table goes — I'll try a different insertion method.That table landed before the Introduction — I'll move it to right after.I see the last insert didn't stick — I'll re-check the file location and add the table correctly.I can read the inference speeds from your screenshot — I'll insert that table after the Introduction.I can read the table clearly — I'll insert it after the Introduction section.I can read the table from your screenshot — I'll insert it after the Introduction.I can read the table from your screenshot clearly — I'll insert it right after the Introduction.";

const FUTURE_TENSE_PATTERN = /\bI(?:'ll|\s+will)\b/gi;

/** Count periods glued to the next sentence (missing space before a capital). */
export function countMissingSpaceAfterPeriod(text: string): number {
  return (text.match(/\.[A-Z]/g) ?? []).length;
}

export function countFutureTensePlans(text: string): number {
  return (text.match(FUTURE_TENSE_PATTERN) ?? []).length;
}

/** Detect concatenated mid-turn planning narration (Muse Spark multi-step tool rounds). */
export function isMashedPlanningText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const futureTenseCount = countFutureTensePlans(trimmed);
  const missingSpaceCount = countMissingSpaceAfterPeriod(trimmed);

  if (futureTenseCount >= 3) return true;
  if (missingSpaceCount >= 2 && futureTenseCount >= 1) return true;
  if (missingSpaceCount >= 3) return true;
  if (futureTenseCount >= 2 && trimmed.length > 200) return true;

  return false;
}

export function resolveAssistantBubbleContent<TOOLS extends ToolSet>(options: {
  rawText: string;
  actions: AiClientAction[];
  result: GenerateTextResult<TOOLS, unknown>;
}): string {
  const trimmed = options.rawText.trim();
  if (!trimmed) return trimmed;

  if (!isMashedPlanningText(trimmed)) return trimmed;

  const appliedSummary = formatAppliedActionsAsAssistantMessage(options.actions);
  if (appliedSummary) return appliedSummary;

  const toolSummary = formatToolResultsAsAssistantMessage(options.result);
  if (toolSummary) return toolSummary;

  if (usedClientEditTools(options.result)) {
    return "I applied the suggested edits.";
  }

  return trimmed;
}
