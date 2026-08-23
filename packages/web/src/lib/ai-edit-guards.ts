/** Generic guards for workspace field edits (not compile-fix-specific). */

export type EditGuardValidation = { ok: true } | { ok: false; reason: string };

const LINE_MACRO_RE = /^\\([a-zA-Z@]+)((?:\[[^\]]*\])?)\{([^}]*)\}/;

export interface ParsedLineMacro {
  macro: string;
  content: string;
  trimmedLine: string;
}

/** Parse a single-line LaTeX macro like \\foo{bar} or \\textit{baz} \\. */
export function parseLineMacro(line: string): ParsedLineMacro | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("%")) return null;
  const match = trimmed.match(LINE_MACRO_RE);
  if (!match) return null;
  return { macro: match[1], content: match[3], trimmedLine: trimmed };
}

/** Count non-comment lines identical to lineText. */
export function countIdenticalNonCommentLines(content: string, lineText: string): number {
  const target = lineText.trim();
  if (!target) return 0;
  let count = 0;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (trimmed === target) count += 1;
  }
  return count;
}

/**
 * Reject edits that stack a new macro sibling immediately below an unchanged line
 * that still holds the previous value, when that line is ambiguous (appears more
 * than once in the original file). Catches fill/replace intent applied to the
 * wrong line without field-name allowlists.
 */
export function validateNoSiblingCommandStacking(
  originalContent: string,
  previewContent: string
): EditGuardValidation {
  const originalLines = originalContent.split("\n");
  const previewLines = previewContent.split("\n");

  for (let i = 0; i < previewLines.length - 1; i += 1) {
    const upperPreview = previewLines[i];
    const lowerPreview = previewLines[i + 1];

    const upperMacro = parseLineMacro(upperPreview);
    const lowerMacro = parseLineMacro(lowerPreview);
    if (!upperMacro || !lowerMacro) continue;
    if (upperMacro.macro !== lowerMacro.macro) continue;
    if (upperMacro.content === lowerMacro.content) continue;

    const originalUpper = originalLines[i] ?? "";
    if (originalUpper.trim() !== upperPreview.trim()) continue;

    const originalLower = originalLines[i + 1] ?? "";
    if (originalLower.trim() === lowerPreview.trim()) continue;

    if (countIdenticalNonCommentLines(originalContent, upperPreview) <= 1) continue;

    return {
      ok: false,
      reason:
        `Edit would stack a new \\${upperMacro.macro}{...} line immediately below an unchanged ` +
        `\\${upperMacro.macro}{...} line that still holds the previous value. ` +
        `Replace the existing line in place (line ${i + 1}) — do not insert a sibling on the next line.`,
    };
  }

  return { ok: true };
}
