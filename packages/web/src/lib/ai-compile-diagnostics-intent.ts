import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

const compileDiagnosticsReviewSchema = z.object({
  reviewCompileDiagnostics: z.boolean(),
});

/**
 * Broad safety-net patterns for compile/log/warning/PDF-status review.
 * Production routing prefers the LLM classifier below; regex catches failures and offline paths.
 */
export const COMPILE_DIAGNOSTICS_REVIEW_FALLBACK_PATTERNS: RegExp[] = [
  /\b(?:check|look at|see|read|review|inspect)\s+(?:the\s+)?(?:compile\s+)?log\b/i,
  /\blog\s+looks?\s+messy\b/i,
  /\bwarnings?\b/i,
  /\boverfull\b/i,
  /\bunderfull\b/i,
  /\bundefined\s+(?:references?|citations?)\b/i,
  /\byellow\s+messages?\b/i,
  /\bunder\s+the\s+editor\b/i,
  /\bcompile\s+clean\b/i,
  /\bdid\s+it\s+compile\b/i,
  /\bwhat(?:'s| is)\s+wrong\s+with\s+(?:the\s+)?compile/i,
  /\bwhy\s+is\s+(?:the\s+)?pdf\s+failing\b/i,
  /\bwhat\s+happened\s+(?:on|with|during)\s+(?:the\s+)?(?:last\s+)?(?:build|compile)/i,
  /\b(?:compile|compilation|build)\s+(?:failed|failing|error)/i,
  /\bpdf\s+(?:failed|failing|not\s+generat)/i,
  /\b(?:any|several)\s+warnings?\b/i,
  /\b(?:pdflatex|xelatex|lualatex)\s+log\b/i,
  /\bcan you see\b/i,
  /\bshowing\b/i,
  /\b(?:any|those)\s+(?:overfull|underfull)\b/i,
];

export const COMPILE_DIAGNOSTICS_REVIEW_EXAMPLE_PHRASES = [
  "can you see the warnings that are showing",
  "we have several warnings, can you check?",
  "what's wrong with the compile",
  "why is the PDF failing",
  "the log looks messy, can you look",
  "those yellow messages under the editor",
  "did it compile clean",
  "any overfull boxes",
  "undefined citations?",
  "check the log",
  "what happened on the last build",
] as const;

export function classifyCompileDiagnosticsReviewFallback(
  message: string,
  action?: string
): boolean {
  if (action === "explain-errors") return false;

  const trimmed = message.trim();
  if (!trimmed) return false;

  const isReview = COMPILE_DIAGNOSTICS_REVIEW_FALLBACK_PATTERNS.some((pattern) =>
    pattern.test(trimmed)
  );
  if (!isReview) return false;

  // Explicit compile-fix requests use the heavy fix path instead of diagnostics review.
  if (/\bfix\b/i.test(trimmed) && /\berrors?\b/i.test(trimmed)) return false;

  return true;
}

/** @deprecated Use classifyCompileDiagnosticsReviewFallback — kept for existing imports. */
export function detectCompileDiagnosticsIntent(text: string, action?: string): boolean {
  return classifyCompileDiagnosticsReviewFallback(text, action);
}

const COMPILE_DIAGNOSTICS_REVIEW_LLM_PROMPT = `You classify whether a LaTeX assistant user wants to REVIEW the last compile result — logs, warnings, errors, PDF/build status — rather than edit manuscript text or search literature.

Answer reviewCompileDiagnostics=true when the user asks about ANY of:
- compile/compilation/build status (success, failure, clean build)
- compiler warnings or errors (including UI hints like yellow messages under the editor)
- the compile log or LaTeX log output
- PDF generation problems (missing PDF, failed PDF)
- overfull/underfull boxes, undefined citations/references from the last compile

Answer reviewCompileDiagnostics=false when the user:
- wants to fix wording or edit the document (unless they only ask what the compile log says)
- searches for papers, cites DOIs, uses Zotero, or imports GitHub repos
- asks general questions about LaTeX syntax unrelated to their project's last compile
- explicitly wants errors fixed in the source (compile-fix) — e.g. "fix the compile errors"

When unsure, prefer true if the message mentions compile, log, warnings, errors, PDF output, or build status.

User message:
`;

export async function classifyCompileDiagnosticsReview(options: {
  message: string;
  compileFix?: boolean;
  model?: LanguageModel;
}): Promise<boolean> {
  const { message, compileFix, model } = options;
  if (compileFix) return false;

  const trimmed = message.trim();
  if (!trimmed) return false;

  if (!model) {
    return classifyCompileDiagnosticsReviewFallback(trimmed);
  }

  try {
    const { object } = await generateObject({
      model,
      schema: compileDiagnosticsReviewSchema,
      maxRetries: 0,
      prompt: `${COMPILE_DIAGNOSTICS_REVIEW_LLM_PROMPT}${trimmed}`,
    });
    return object.reviewCompileDiagnostics;
  } catch {
    return classifyCompileDiagnosticsReviewFallback(trimmed);
  }
}
