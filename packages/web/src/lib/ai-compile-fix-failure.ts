import type { StepResult, ToolSet } from "ai";
import { summarizeToolResult } from "@/lib/ai-response";
import { getPrimaryCompileErrorLocation, type AiCompileError } from "@/lib/ai-compile-fix-context";
import { buildMissingCompilerPackageUserMessage } from "@/lib/compile-fix-missing-package-message";
import { isMissingCompilerPackageOutcome, analyzeCompileMissingPackage } from "@/lib/compile-missing-package";

type GetFileCall = { path: string; startLine: number; endLine: number };

function collectAttemptedEdits<TOOLS extends ToolSet>(
  steps: StepResult<TOOLS>[]
): string[] {
  const attempts: string[] = [];

  for (const step of steps) {
    for (const toolResult of step.toolResults) {
      if (
        toolResult.toolName === "replace_lines" ||
        toolResult.toolName === "apply_edit" ||
        toolResult.toolName === "fix_compile_errors"
      ) {
        const summary = summarizeToolResult(toolResult.toolName, toolResult.result);
        if (summary) attempts.push(summary);
      }
    }
  }

  return attempts;
}

/** One-sentence failure when compile-fix finishes without applying an edit. */
export function buildCompileFixNoEditMessage(options: {
  errors: AiCompileError[];
  getFileCalls: GetFileCall[];
  steps: StepResult<ToolSet>[];
  log?: string;
  page?: string;
}): string {
  const missingPackage = analyzeCompileMissingPackage({
    errors: options.errors,
    log: options.log,
  });
  if (isMissingCompilerPackageOutcome(missingPackage)) {
    return buildMissingCompilerPackageUserMessage({
      packageName: missingPackage.package,
      command: missingPackage.command,
      page: options.page,
    });
  }

  const location = getPrimaryCompileErrorLocation(options.errors);
  const editAttempts = collectAttemptedEdits(options.steps);

  if (location && options.getFileCalls.length > 0) {
    const read = options.getFileCalls[options.getFileCalls.length - 1];
    const readRange =
      read.startLine === read.endLine
        ? `line ${read.startLine}`
        : `lines ${read.startLine}–${read.endLine}`;

    if (editAttempts.length > 0) {
      return `I read ${read.path} (${readRange}) around the error at line ${location.line}, but the edit was rejected (${editAttempts[editAttempts.length - 1]}).`;
    }

    return `I read ${read.path} (${readRange}) around line ${location.line} but could not apply an edit — the model did not produce a valid replace_lines or apply_edit call.`;
  }

  if (location) {
    if (editAttempts.length > 0) {
      return `I tried to fix ${location.file} at line ${location.line}, but the edit was rejected (${editAttempts[editAttempts.length - 1]}).`;
    }
    return `I could not fix ${location.file} at line ${location.line} — no edit was applied.`;
  }

  if (editAttempts.length > 0) {
    return `Compile errors remain — the last edit attempt failed (${editAttempts[editAttempts.length - 1]}).`;
  }

  return "I could not apply an edit for these compile errors.";
}
