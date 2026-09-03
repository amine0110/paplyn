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
  /\breferences?\s+(?:are|is|were)\s+(?:at\s+the\s+)?(?:top|wrong|beginning|start)\b/i,
  /\b(?:beginning|start)\s+of\s+(?:the\s+)?(?:paper|document|manuscript|article)\b.+\b(?:references?|bibliograph(?:y|ies))\b/i,
  /\b(?:references?|bibliograph(?:y|ies))\b.+\b(?:beginning|start)\s+of\s+(?:the\s+)?(?:paper|document|manuscript|article)\b/i,
  /\b(?:references?|bibliograph(?:y|ies))\s+section\b.+\b(?:beginning|start|top|wrong)\b/i,
  /\bwhy\b.+\b(?:references?|bibliograph(?:y|ies))\b/i,
  /\bwhy\b.+\b(?:references?|bibliograph(?:y|ies))\s+section\b/i,
  /\bcan\s+you\s+fix\s+this\b/i,
  /\bdo\s+the\s+fix\b/i,
  /\bfix\s+this\b/i,
  /\bfix\s+it\b/i,
];

/** Paper-structure questions that imply a fix when bibliography is misplaced. */
const MANUSCRIPT_STRUCTURE_CONCERN_PATTERNS: RegExp[] = [
  /\bwhy\b.+\b(?:paper|document|manuscript|article|pdf)\b/i,
  /\bwhat(?:'s| is) wrong\b/i,
  /\bwhat\s+is\s+wrong\b/i,
  /\b(?:references?|bibliograph(?:y|ies))\b/i,
  /\b(?:beginning|start|top)\s+of\s+(?:the\s+)?(?:paper|document|manuscript|article)\b/i,
  /\bdo\s+the\s+fix\b/i,
  /\bcan\s+you\s+fix\b/i,
  /\brecompile\b/i,
];

/** User wants misplaced references moved back — inferred from message, not paper title. */
export function detectReferencesRecoveryIntent(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return REFERENCES_RECOVERY_INTENT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Broader paper-structure concern — pairs with misplaced bibliography for recovery short-circuit. */
export function detectManuscriptStructureConcern(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return (
    detectReferencesRecoveryIntent(trimmed) ||
    MANUSCRIPT_STRUCTURE_CONCERN_PATTERNS.some((pattern) => pattern.test(trimmed))
  );
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
