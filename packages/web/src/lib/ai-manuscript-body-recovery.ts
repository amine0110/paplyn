/** Recover misplaced body content (tables/figures) before \\documentclass. */

import { formatCompileFixLineChangeSummary } from "@/lib/ai-compile-fix-validation";
import type { AiClientAction } from "@/lib/ai-client-actions";
import { applyLinesReplace } from "@/lib/ai-client-actions";
import {
  buildBodyContentInsertPlan,
  findMisplacedBodyBlock,
  isPreambleMissing,
  type MisplacedBodyBlockRange,
} from "@/lib/ai-manuscript-guards";

export interface MisplacedBodyRecoveryPlan {
  file: string;
  removeStart: number;
  removeEnd: number;
  blockText: string;
  insertStartLine: number;
  insertEndLine: number;
  insertReplace: string;
  previewContent: string;
  preambleMissing: boolean;
}

export function buildMisplacedBodyRecoveryPlan(
  file: string,
  content: string,
  userMessage?: string
): MisplacedBodyRecoveryPlan | null {
  const misplaced = findMisplacedBodyBlock(content);
  if (!misplaced) return null;

  const blockText = misplaced.blockLines.join("\n");
  const withoutBlock = [
    ...content.split("\n").slice(0, misplaced.startLine - 1),
    ...content.split("\n").slice(misplaced.endLine),
  ].join("\n");

  const insertPlan = buildBodyContentInsertPlan(withoutBlock, blockText, userMessage);
  if (!insertPlan) return null;

  const removeResult = applyLinesReplace(
    content,
    misplaced.startLine,
    misplaced.endLine,
    ""
  );
  if (!removeResult.ok) return null;

  const insertResult = applyLinesReplace(
    removeResult.content,
    insertPlan.startLine,
    insertPlan.endLine,
    insertPlan.replace
  );
  if (!insertResult.ok) return null;

  return {
    file,
    removeStart: misplaced.startLine,
    removeEnd: misplaced.endLine,
    blockText,
    insertStartLine: insertPlan.startLine,
    insertEndLine: insertPlan.endLine,
    insertReplace: insertPlan.replace,
    previewContent: insertResult.content,
    preambleMissing: isPreambleMissing(content),
  };
}

export function buildMisplacedBodyRecoveryActions(plan: MisplacedBodyRecoveryPlan): AiClientAction[] {
  return [
    {
      type: "replace_lines",
      file: plan.file,
      startLine: plan.removeStart,
      endLine: plan.removeEnd,
      replace: "",
      label: `Removed misplaced content from top of ${plan.file}`,
    },
    {
      type: "replace_lines",
      file: plan.file,
      startLine: plan.insertStartLine,
      endLine: plan.insertEndLine,
      replace: plan.insertReplace,
      label: `Inserted content after abstract in ${plan.file}`,
    },
  ];
}

export function buildMisplacedBodyRecoveryMessage(plan: MisplacedBodyRecoveryPlan): string {
  const changeSummary = formatCompileFixLineChangeSummary({
    file: plan.file,
    startLine: plan.removeStart,
    endLine: plan.removeEnd,
  });

  if (plan.preambleMissing) {
    return (
      `${changeSummary} The manuscript preamble is missing \\documentclass — I cannot fully restore it automatically. ` +
      "I removed the misplaced body block from the top and reinserted it after the abstract. " +
      "Please restore \\documentclass, packages, and author/title blocks manually."
    );
  }

  return (
    `${changeSummary} Removed misplaced body content before \\documentclass and inserted it after the abstract. ` +
    "Recompile to verify the PDF."
  );
}

export function detectMisplacedBodyRecoveryIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return (
    /before\s+(the\s+)?document\s+init/i.test(lower) ||
    /before\s+\\documentclass/i.test(lower) ||
    /between\s+(the\s+)?abstract\s+and\s+(the\s+)?intro/i.test(lower) ||
    /put\s+it\s+between/i.test(lower) ||
    /misplaced\s+table/i.test(lower) ||
    /inserted\s+it\s+(on\s+top|at\s+the\s+top|before)/i.test(lower) ||
    /removed\s+paper\s+settings/i.test(lower) ||
    /removed\s+several\s+things/i.test(lower)
  );
}

export function tryMisplacedBodyRecovery(options: {
  texFiles: Map<string, string>;
  mainFile: string;
  userMessage: string;
  activeFile?: string;
}): { actions: AiClientAction[]; message: string; file: string } | null {
  const orderedPaths = [
    options.activeFile ?? options.mainFile,
    options.mainFile,
    ...[...options.texFiles.keys()]
      .filter((path) => path !== options.mainFile && path !== options.activeFile)
      .sort(),
  ];

  const intentRecovery = detectMisplacedBodyRecoveryIntent(options.userMessage);

  for (const file of orderedPaths) {
    const content = options.texFiles.get(file);
    if (content == null) continue;

    const misplaced = findMisplacedBodyBlock(content);
    if (!misplaced && !intentRecovery) continue;
    if (!misplaced) continue;

    const plan = buildMisplacedBodyRecoveryPlan(file, content, options.userMessage);
    if (!plan) continue;

    return {
      actions: buildMisplacedBodyRecoveryActions(plan),
      message: buildMisplacedBodyRecoveryMessage(plan),
      file,
    };
  }

  return null;
}

export type { MisplacedBodyBlockRange };
