/** Server-side guards for compile-fix edits on real LaTeX manuscripts. */

const DOCUMENTCLASS_RE = /^\s*\\documentclass\b/;
const REQUIRE_PACKAGE_RE = /^\s*\\RequirePackage\b/;
const BEGIN_DOCUMENT_MARKER_RE = /\\begin\{document/;
const USEPACKAGE_LINE_RE = /^\s*\\usepackage(\[[^\]]*\])?\s*\{[^}]+\}\s*$/;
const BARE_USEPACKAGE_RE = /^\s*\\usepackage(\[[^\]]*\])?\s*$/;
const USEPACKAGE_PKG_RE = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;

const FLOAT_BEGIN_RE = /\\begin\{(?:table\*?|figure\*?|tabular\*?)\}/g;
const BIBLIOGRAPHY_RE = /\\(?:bibliography\{|begin\{thebibliography\})|\\bibitem\b/g;
const NEW_SECTION_RE = /\\(?:section|subsection)\{/g;

function countPatternMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

export type NoDummyManuscriptValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Reject placeholder tables/figures/sections/bibliography invented to silence undefined refs/cites.
 * Allows adding \\label on existing content and fixing citation wiring.
 */
export function validateNoDummyManuscriptContent(options: {
  replace: string;
  originalLines?: string[];
}): NoDummyManuscriptValidation {
  const { replace, originalLines } = options;
  const originalBlock = originalLines?.join("\n") ?? "";

  const floatAdds = countPatternMatches(replace, FLOAT_BEGIN_RE) - countPatternMatches(originalBlock, FLOAT_BEGIN_RE);
  if (floatAdds > 0) {
    return {
      ok: false,
      reason:
        "Edit would add a new table or figure environment to silence undefined refs. " +
        "Attach \\label to an existing float if it exists, or tell the user which label is missing — " +
        "do not invent placeholder floats.",
    };
  }

  const bibAdds =
    countPatternMatches(replace, BIBLIOGRAPHY_RE) - countPatternMatches(originalBlock, BIBLIOGRAPHY_RE);
  if (bibAdds > 0) {
    return {
      ok: false,
      reason:
        "Edit would add bibliography or \\bibitem entries to silence undefined citations. " +
        "Fix \\cite/\\bibliography/natbib wiring from the project .bib when keys exist, " +
        "or tell the user which citation keys are missing — do not invent bib entries or stub bibliographies.",
    };
  }

  const sectionAdds =
    countPatternMatches(replace, NEW_SECTION_RE) - countPatternMatches(originalBlock, NEW_SECTION_RE);
  if (sectionAdds > 0) {
    return {
      ok: false,
      reason:
        "Edit would add a new section to silence compile warnings. " +
        "Explain which labels or citations are missing instead of inventing manuscript sections.",
    };
  }

  return { ok: true };
}

export interface FirstNonCommentLine {
  line: number;
  text: string;
}

/** First non-empty, non-comment line (1-based). */
export function getFirstNonCommentLine(content: string): FirstNonCommentLine | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    return { line: i + 1, text: lines[i] };
  }
  return null;
}

/** True for \\begin{document} and broken \\begin{document without a closing brace. */
export function isBeginDocumentLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("%")) return false;
  return BEGIN_DOCUMENT_MARKER_RE.test(trimmed);
}

/** Line number of the last line in the first compiled document copy. */
export function getFirstLaTeXCopyEndLine(content: string): number {
  const lines = content.split("\n");
  let seenBeginDocument = false;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;

    if (trimmed.includes("\\end{document}")) {
      return i + 1;
    }

    if (isBeginDocumentLine(trimmed)) {
      seenBeginDocument = true;
      continue;
    }

    if (DOCUMENTCLASS_RE.test(trimmed)) {
      if (seenBeginDocument) {
        return i;
      }
    }
  }

  return lines.length;
}

export function getDocumentClassLine(content: string): number | null {
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const lines = content.split("\n");
  const limit = Math.min(firstCopyEnd, lines.length);

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (DOCUMENTCLASS_RE.test(trimmed) || trimmed.includes("\\documentclass")) {
      return i + 1;
    }
    if (REQUIRE_PACKAGE_RE.test(trimmed)) {
      return i + 1;
    }
  }
  return null;
}

export function isValidLaTeXFirstLine(text: string): boolean {
  const trimmed = text.trim();
  return DOCUMENTCLASS_RE.test(trimmed) || REQUIRE_PACKAGE_RE.test(trimmed);
}

export type LaTeXPreambleValidation =
  | { ok: true }
  | { ok: false; reason: string };

/** Count non-comment \\documentclass lines before the first \\begin{document} (including broken). */
export function countDocumentClassLinesBeforeBeginDocument(content: string): number {
  const lines = content.split("\n");
  const limit = Math.min(getFirstLaTeXCopyEndLine(content), lines.length);
  let count = 0;

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (isBeginDocumentLine(trimmed)) break;
    if (DOCUMENTCLASS_RE.test(trimmed)) count += 1;
  }

  return count;
}

/** Count non-comment \\documentclass lines in the first document copy. */
export function countDocumentClassLinesInFirstCopy(content: string): number {
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const lines = content.split("\n");
  const limit = Math.min(firstCopyEnd, lines.length);
  let count = 0;

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (DOCUMENTCLASS_RE.test(trimmed)) count += 1;
  }

  return count;
}

/** Rule 0: exactly one \\documentclass before \\begin{document} (no duplicate preamble inserts). */
export function validateNoDuplicateDocumentClass(content: string): LaTeXPreambleValidation {
  const count = countDocumentClassLinesBeforeBeginDocument(content);
  if (count <= 1) return { ok: true };

  return {
    ok: false,
    reason:
      `Edit would leave ${count} \\documentclass lines before \\begin{document}. ` +
      `Keep exactly one \\documentclass as the first non-comment line — repair the cited line instead of inserting another.`,
  };
}

/** Count \\begin{document} on non-comment lines in the first document copy. */
export function countBeginDocumentInFirstCopy(content: string): number {
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const lines = content.split("\n");
  const limit = Math.min(firstCopyEnd, lines.length);
  let count = 0;

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (isBeginDocumentLine(trimmed)) count += 1;
  }

  return count;
}

/** Rule 0b: exactly one \\begin{document} in the first copy (no duplicate body opens). */
export function validateNoDuplicateBeginDocument(content: string): LaTeXPreambleValidation {
  const count = countBeginDocumentInFirstCopy(content);
  if (count <= 1) return { ok: true };

  return {
    ok: false,
    reason:
      `Edit would leave ${count} \\begin{document} in the first document copy. ` +
      `Keep exactly one — repair the cited line instead of inserting another \\begin{document}.`,
  };
}

/** Rule 1: first non-comment line must be \\documentclass or \\RequirePackage. */
export function validateLaTeXPreambleOrder(content: string): LaTeXPreambleValidation {
  const first = getFirstNonCommentLine(content);
  if (!first) return { ok: true };
  if (isValidLaTeXFirstLine(first.text)) return { ok: true };

  const preview = first.text.trim().slice(0, 80);
  return {
    ok: false,
    reason:
      `Edit would put \\usepackage, \\title, or body content before \\documentclass ` +
      `(line ${first.line} is "${preview}${first.text.trim().length > 80 ? "…" : ""}"). ` +
      `Repair the cited line in the first document copy — do not prepend a new preamble.`,
  };
}

function extractUsepackageNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(USEPACKAGE_PKG_RE)) {
    const pkgList = match[1] ?? "";
    for (const pkg of pkgList.split(",")) {
      const name = pkg.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function replacedLinesAreBareUsepackage(lines: string[]): boolean {
  return lines.some((line) => BARE_USEPACKAGE_RE.test(line.trim()));
}

/** Rule 2: do not invent \\usepackage{pkg} unless that exact line already existed. */
export function validateNoInventedPackages(
  originalLines: string[],
  replace: string
): LaTeXPreambleValidation {
  const originalBlock = originalLines.join("\n");
  const replaceNames = extractUsepackageNames(replace);
  if (replaceNames.length === 0) return { ok: true };

  if (replacedLinesAreBareUsepackage(originalLines)) {
    return { ok: true };
  }

  for (const pkg of replaceNames) {
    const exactLine = `\\usepackage{${pkg}}`;
    const alreadyOnReplacedLine = originalLines.some(
      (line) => line.trim() === exactLine || line.includes(`{${pkg}}`)
    );
    if (!alreadyOnReplacedLine && !originalBlock.includes(`{${pkg}}`)) {
      return {
        ok: false,
        reason:
          `Edit would add new package "${pkg}" via \\usepackage{${pkg}}. ` +
          `Only repair the existing line — do not invent packages that were not already present.`,
      };
    }
  }

  return { ok: true };
}

export interface ValidateCompileFixEditOptions {
  content: string;
  startLine?: number;
  endLine?: number;
  replace: string;
  /** Search span for apply_edit validation. */
  search?: string;
  /** Resulting file content after the edit. */
  previewContent: string;
}

/** Composite compile-fix validation after a proposed edit. */
export function validateCompileFixEdit(
  options: ValidateCompileFixEditOptions
): LaTeXPreambleValidation {
  const { content, startLine, endLine, replace, search, previewContent } = options;

  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  if (startLine != null && startLine > firstCopyEnd) {
    return {
      ok: false,
      reason:
        `Edit targets line ${startLine}, which is past the first document copy ` +
        `(ends at line ${firstCopyEnd}). Only edit the first \\documentclass…\\end{document} block.`,
    };
  }
  if (endLine != null && endLine > firstCopyEnd) {
    return {
      ok: false,
      reason:
        `Edit range ends at line ${endLine}, past the first document copy ` +
        `(ends at line ${firstCopyEnd}). Only edit the first \\documentclass…\\end{document} block.`,
    };
  }

  const duplicateDocumentClass = validateNoDuplicateDocumentClass(previewContent);
  if (!duplicateDocumentClass.ok) return duplicateDocumentClass;

  const duplicateBeginDocument = validateNoDuplicateBeginDocument(previewContent);
  if (!duplicateBeginDocument.ok) return duplicateBeginDocument;

  const fixingBeginDocumentLine =
    startLine != null &&
    endLine != null &&
    startLine === endLine &&
    isBeginDocumentLine(content.split("\n")[startLine - 1] ?? "");

  const preamble: LaTeXPreambleValidation = fixingBeginDocumentLine
    ? { ok: true as const }
    : validateLaTeXPreambleOrder(previewContent);
  if (!preamble.ok) return preamble;

  if (startLine != null && endLine != null) {
    const originalLines = content.split("\n").slice(startLine - 1, endLine);
    const packageCheck = validateNoInventedPackages(originalLines, replace);
    if (!packageCheck.ok) return packageCheck;
  }

  const originalLines =
    startLine != null && endLine != null
      ? content.split("\n").slice(startLine - 1, endLine)
      : search
        ? search.split("\n")
        : [];
  const dummyCheck = validateNoDummyManuscriptContent({ replace, originalLines });
  if (!dummyCheck.ok) return dummyCheck;

  const documentClassLine = getDocumentClassLine(content);
  if (
    documentClassLine != null &&
    startLine != null &&
    startLine < documentClassLine &&
    replace.trim().length > 0
  ) {
    const replaceFirst = getFirstNonCommentLine(replace);
    if (replaceFirst && !isValidLaTeXFirstLine(replaceFirst.text)) {
      return {
        ok: false,
        reason:
          `Edit would insert content before \\documentclass (line ${documentClassLine}). ` +
          `Repair the cited error line — do not prepend a new preamble.`,
      };
    }
  }

  return { ok: true };
}

/** Format an exact line-change summary for assistant replies (rule 5). */
export function formatCompileFixLineChangeSummary(options: {
  file: string;
  startLine: number;
  endLine: number;
}): string {
  const { file, startLine, endLine } = options;
  const range =
    startLine === endLine ? `line ${startLine}` : `lines ${startLine}–${endLine}`;
  return `Changed ${file} ${range}.`;
}
