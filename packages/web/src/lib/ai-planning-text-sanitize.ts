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

/** PAP-52 follow-up screenshot: progressive + future planning mashed with past-tense bullets. */
export const DOCUMENT_CLASS_PLANNING_SAMPLE =
  "Fixing the missing document class so your file can compile.That first fix removed a package line — I'll check the current state to restore it properly.Changed template.tex line 3.\n\n- The file started with \\usepackage lines but had no \\documentclass, which causes LaTeX Error: \\usepackage before \\documentclass.\n- Added `\\documentclass{article}` at line 3 to establish the preamble correctly.\n\nDone.";

const FUTURE_TENSE_PATTERN = /\bI(?:'ll|\s+will)\b/i;

const PROGRESSIVE_PLANNING_START =
  /^(?:Fixing|Checking|Looking|Reading|Searching|Trying|Updating|Adding|Inserting|Moving|Restoring|Locating|Finding|Preparing|Working|Going|Opening|Scanning|Reviewing|Examining|Inspecting|Analyzing|Assessing|Determining|Figuring|Sorting|Cleaning|Removing|Deleting|Replacing|Creating|Writing|Editing|Reverting|Undoing|Re-checking|Rechecking|Transcribing)\b/i;

const INTENT_WHILE_WORKING_PATTERN = /\bso (?:your|the) (?:file|document|paper|project|manuscript)\b/i;

const MID_WORK_NARRATION_START =
  /^(?:That first fix|Found your project|I see where|I see the last|Now I'll|Now I will|I'm going to|I am going to|I(?:'m| am) (?:checking|looking|reading|searching|trying|updating|adding|inserting|moving|restoring))\b/i;

const PAST_TENSE_ACTION_BULLET_START =
  /^(?:Added|Fixed|Inserted|Updated|Replaced|Moved|Removed|Deleted|Restored|Changed)\b/i;

/** Count periods glued to the next sentence (missing space before a capital). */
export function countMissingSpaceAfterPeriod(text: string): number {
  return (text.match(/\.[A-Z]/g) ?? []).length;
}

export function countFutureTensePlans(text: string): number {
  return (text.match(/\bI(?:'ll|\s+will)\b/gi) ?? []).length;
}

export function hasFutureTensePlanning(text: string): boolean {
  return FUTURE_TENSE_PATTERN.test(text);
}

export function hasProgressivePlanning(text: string): boolean {
  const normalized = fixSentenceSpacing(text.trim());
  if (!normalized) return false;

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  return sentences.some((sentence) => isProgressivePlanningSentence(sentence));
}

export function isProgressivePlanningSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  if (hasFutureTensePlanning(trimmed)) return true;
  if (PROGRESSIVE_PLANNING_START.test(trimmed)) return true;
  if (INTENT_WHILE_WORKING_PATTERN.test(trimmed)) return true;
  if (MID_WORK_NARRATION_START.test(trimmed)) return true;
  if (/^Now (?:I'll|I will|I'm|I am)\b/i.test(trimmed)) return true;
  if (/^I(?:'m| am) (?:going to|about to)\b/i.test(trimmed)) return true;
  return false;
}

/** Insert missing spaces after sentence-ending periods before a capital letter. */
export function fixSentenceSpacing(text: string): string {
  return text.replace(/\.([A-Z])/g, ". $1");
}

/** Drop sentences that narrate planned or in-progress work. */
export function stripPlanningSentences(text: string): string {
  const normalized = fixSentenceSpacing(text.trim());
  if (!normalized) return "";

  const sentences = normalized.split(/(?<=[.!?])\s+/);
  const kept = sentences
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && !isProgressivePlanningSentence(sentence));

  return kept.join(" ").trim();
}

/** @deprecated Use stripPlanningSentences — kept for existing imports/tests. */
export function stripFutureTenseSentences(text: string): string {
  return stripPlanningSentences(text);
}

/** Detect concatenated mid-turn planning narration (Muse Spark multi-step tool rounds). */
export function isMashedPlanningText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const futureTenseCount = countFutureTensePlans(trimmed);
  const missingSpaceCount = countMissingSpaceAfterPeriod(trimmed);
  const progressiveCount = trimmed
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => isProgressivePlanningSentence(sentence)).length;

  if (futureTenseCount >= 3) return true;
  if (missingSpaceCount >= 2 && futureTenseCount >= 1) return true;
  if (missingSpaceCount >= 3) return true;
  if (futureTenseCount >= 2 && trimmed.length > 200) return true;
  if (progressiveCount >= 2 && missingSpaceCount >= 1) return true;
  if (progressiveCount >= 1 && futureTenseCount >= 1) return true;

  return false;
}

function stripTrailingDone(text: string): string {
  return text.replace(/\n*Done\.\s*$/i, "").trim();
}

function extractBulletLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, "").trim())
    .filter((line) => line.length > 0);
}

function isContextBullet(bullet: string): boolean {
  const trimmed = bullet.trim();
  if (!trimmed) return false;
  if (isProgressivePlanningSentence(trimmed)) return false;
  if (PAST_TENSE_ACTION_BULLET_START.test(trimmed)) return false;
  return true;
}

function isWeakSalvagedContext(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (hasFutureTensePlanning(trimmed)) return true;
  if (hasProgressivePlanning(trimmed)) return true;
  if (trimmed.length < 12) return true;
  if (/^I (?:see|can read)\b/i.test(trimmed) && trimmed.length < 80) return true;
  if (/^Changed\b/i.test(trimmed) && trimmed.length < 60) return true;
  return false;
}

function extractSalvagedContextFromRaw(text: string): string | null {
  const withoutDone = stripTrailingDone(text.trim());
  const bullets = extractBulletLines(withoutDone);
  const contextBullets = bullets.filter(isContextBullet).filter((bullet) => !isWeakSalvagedContext(bullet));

  const proseBlock = withoutDone
    .split(/\n+/)
    .filter((line) => !/^-\s+/.test(line.trim()))
    .join(" ")
    .trim();

  const salvagedProse = stripPlanningSentences(proseBlock);
  const proseContext =
    salvagedProse && !isWeakSalvagedContext(salvagedProse) ? salvagedProse : null;

  const parts = [proseContext, ...contextBullets].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;

  return parts.join("\n\n").trim();
}

/** Readable bullet list of applied edits, ending with Done. */
export function formatAppliedActionsSummary(actions: AiClientAction[]): string | null {
  const labels = actions.map((action) => action.label.trim()).filter((label) => label.length > 0);
  if (labels.length === 0) return null;

  const bullets = labels.map((label) => `- ${label}`).join("\n");
  return `${bullets}\n\nDone.`;
}

function shouldSanitizeBubble(trimmed: string, hasEdits: boolean): boolean {
  if (!trimmed) return false;
  if (isMashedPlanningText(trimmed)) return true;
  if (hasEdits && (hasFutureTensePlanning(trimmed) || hasProgressivePlanning(trimmed))) return true;
  return false;
}

export function resolveAssistantBubbleContent<TOOLS extends ToolSet>(options: {
  rawText: string;
  actions: AiClientAction[];
  result: GenerateTextResult<TOOLS, unknown>;
}): string {
  const trimmed = options.rawText.trim();
  if (!trimmed) return trimmed;

  const hasEdits = options.actions.length > 0;
  if (!shouldSanitizeBubble(trimmed, hasEdits)) return trimmed;

  const salvagedContext = extractSalvagedContextFromRaw(trimmed);
  const actionSummary = formatAppliedActionsSummary(options.actions);

  if (actionSummary) {
    if (salvagedContext && !isWeakSalvagedContext(salvagedContext)) {
      const bullets = actionSummary.replace(/\n\nDone\.$/, "");
      return `${salvagedContext}\n\n${bullets}\n\nDone.`;
    }
    return actionSummary;
  }

  if (salvagedContext && !isWeakSalvagedContext(salvagedContext)) {
    return salvagedContext.endsWith("Done.") ? salvagedContext : `${salvagedContext}\n\nDone.`;
  }

  const flatSummary = formatAppliedActionsAsAssistantMessage(options.actions);
  if (flatSummary) return `${flatSummary}\n\nDone.`;

  const toolSummary = formatToolResultsAsAssistantMessage(options.result);
  if (toolSummary) return toolSummary;

  if (usedClientEditTools(options.result)) {
    return "I applied the suggested edits.\n\nDone.";
  }

  const stripped = stripPlanningSentences(trimmed);
  return stripped || trimmed;
}
