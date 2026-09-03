import {
  validateBibliographyStructure,
  type BibliographyStructureValidation,
} from "@/lib/ai-compile-fix-validation";

export const ABSTRACT_BEGIN_RE = /\\begin\{abstract\}/;
export const ABSTRACT_CMD_RE = /\\abstract\b/;

const REFERENCES_RECOVERY_INTENT_PATTERNS: RegExp[] = [
  /\bfix\b.+\b(references?|bibliograph(?:y|ies)|citations?)\b/i,
  /\b(references?|bibliograph(?:y|ies)|citations?)\b.+\bfix\b/i,
  /\bput\b.+\b(references?|bibliograph(?:y|ies))\b.+\b(back|end)\b/i,
  /\bmove\b.+\b(references?|bibliograph(?:y|ies))\b.+\b(end|back)\b/i,
  /\brestore\b.+\b(references?|bibliograph(?:y|ies))\b/i,
  /\breferences?\s+(?:are|were)\s+(?:at\s+the\s+)?(?:top|wrong|beginning|start)\b/i,
  /\b(?:beginning|start)\s+of\s+(?:the\s+)?(?:paper|document|manuscript)\b.+\b(?:references?|bibliograph(?:y|ies))\b/i,
  /\b(?:references?|bibliograph(?:y|ies))\b.+\b(?:beginning|start)\s+of\s+(?:the\s+)?(?:paper|document|manuscript)\b/i,
  /\bfix\s+it\b/i,
];

/** User wants misplaced references moved back — inferred from message, not paper title. */
export function detectReferencesRecoveryIntent(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return REFERENCES_RECOVERY_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** True when bibliography output appears before abstract/body in the first copy. */
export function isMisplacedBibliographyStructure(content: string): boolean {
  return !validateBibliographyStructure(content).ok;
}

export function describeBibliographyStructureIssue(
  content: string
): BibliographyStructureValidation {
  return validateBibliographyStructure(content);
}
