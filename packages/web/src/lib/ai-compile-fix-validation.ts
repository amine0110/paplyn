/** Server-side guards for compile-fix edits on real LaTeX manuscripts. */

const DOCUMENTCLASS_RE = /^\s*\\documentclass\b/;
const REQUIRE_PACKAGE_RE = /^\s*\\RequirePackage\b/;
const USEPACKAGE_LINE_RE = /^\s*\\usepackage(\[[^\]]*\])?\s*\{[^}]+\}\s*$/;
const BARE_USEPACKAGE_RE = /^\s*\\usepackage(\[[^\]]*\])?\s*$/;
const USEPACKAGE_PKG_RE = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;

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

/** Line number of the last line in the first compiled document copy. */
export function getFirstLaTeXCopyEndLine(content: string): number {
  const lines = content.split("\n");
  let firstDocumentClassLine: number | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;

    if (DOCUMENTCLASS_RE.test(trimmed)) {
      if (firstDocumentClassLine == null) {
        firstDocumentClassLine = i + 1;
        continue;
      }
      return i;
    }

    if (trimmed.includes("\\end{document}")) {
      return i + 1;
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

/** Count non-comment \\documentclass lines before the first \\begin{document}. */
export function countDocumentClassLinesBeforeBeginDocument(content: string): number {
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (trimmed.includes("\\begin{document}")) break;
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
  /** Resulting file content after the edit. */
  previewContent: string;
}

/** Composite compile-fix validation after a proposed edit. */
export function validateCompileFixEdit(
  options: ValidateCompileFixEditOptions
): LaTeXPreambleValidation {
  const { content, startLine, endLine, replace, previewContent } = options;

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

  const preamble = validateLaTeXPreambleOrder(previewContent);
  if (!preamble.ok) return preamble;

  if (startLine != null && endLine != null) {
    const originalLines = content.split("\n").slice(startLine - 1, endLine);
    const packageCheck = validateNoInventedPackages(originalLines, replace);
    if (!packageCheck.ok) return packageCheck;
  }

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
