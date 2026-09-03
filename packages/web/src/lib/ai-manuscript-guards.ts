/** Server-side guards for LaTeX manuscript edits (PAP-50). */

import {
  getBeginDocumentLineIndex,
  getDocumentClassLine,
  getFirstLaTeXCopyEndLine,
  getFirstNonCommentLine,
  isBeginDocumentLine,
  isValidLaTeXFirstLine,
  type LaTeXPreambleValidation,
} from "@/lib/ai-compile-fix-validation";

const MAKETITLE_RE = /\\maketitle\b/;

const BODY_FLOAT_BEGIN_RE = /\\begin\{(?:table\*?|figure\*?|tabular\*?)\}/;
const BODY_SECTION_RE = /\\(?:section|subsection)\{/;
const BODY_TABLE_CMD_RE = /\\begin\{table/;

export function containsBodyManuscriptContent(text: string): boolean {
  if (!text.trim()) return false;
  return (
    BODY_FLOAT_BEGIN_RE.test(text) ||
    BODY_TABLE_CMD_RE.test(text) ||
    BODY_SECTION_RE.test(text)
  );
}

function isCommentOrBlankLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed.startsWith("%");
}

/** 1-based line number of \\end{abstract}, or null. */
export function findEndAbstractLine(content: string): number | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const bodyStart = getBeginDocumentLineIndex(content);
  const start = bodyStart != null ? bodyStart + 1 : 0;

  for (let i = start; i < firstCopyEnd; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    if (/\\end\{abstract\}/.test(line)) return i + 1;
  }
  return null;
}

/** 1-based line number of first \\section{Introduction} (or similar intro heading). */
export function findIntroductionSectionLine(content: string): number | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const bodyStart = getBeginDocumentLineIndex(content);
  const start = bodyStart != null ? bodyStart + 1 : 0;

  for (let i = start; i < firstCopyEnd; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    const match = line.match(/\\section\*?\{([^}]*)\}/);
    if (!match) continue;
    const title = (match[1] ?? "").trim().toLowerCase();
    if (title === "introduction" || title === "intro") return i + 1;
  }
  return null;
}

/** 1-based \\maketitle line, or null. */
export function findMaketitleLine(content: string): number | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const bodyStart = getBeginDocumentLineIndex(content);
  const start = bodyStart != null ? bodyStart + 1 : 0;

  for (let i = start; i < firstCopyEnd; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    if (MAKETITLE_RE.test(line)) return i + 1;
  }
  return null;
}

export type InsertAnchorKind = "after_abstract" | "after_maketitle" | "before_introduction";

export function detectInsertAnchorIntent(userMessage: string): InsertAnchorKind | null {
  const lower = userMessage.toLowerCase();
  if (
    /between\s+(the\s+)?abstract\s+and\s+(the\s+)?intro/i.test(lower) ||
    /after\s+(the\s+)?abstract.*before\s+(the\s+)?intro/i.test(lower)
  ) {
    return "before_introduction";
  }
  if (/after\s+(the\s+)?abstract/i.test(lower)) {
    return "after_abstract";
  }
  if (/before\s+(the\s+)?intro/i.test(lower)) {
    return "before_introduction";
  }
  return null;
}

/** Resolve where body content (tables, figures) should be inserted in the manuscript. */
export function resolveBodyContentInsertLine(
  content: string,
  anchorIntent?: InsertAnchorKind | null
): number | null {
  const beginDocIdx = getBeginDocumentLineIndex(content);
  if (beginDocIdx == null) return null;

  const introLine = findIntroductionSectionLine(content);
  const abstractEnd = findEndAbstractLine(content);
  const maketitleLine = findMaketitleLine(content);

  const intent = anchorIntent ?? "after_abstract";

  if (intent === "before_introduction" && introLine != null) {
    return introLine;
  }

  if (abstractEnd != null) {
    return abstractEnd + 1;
  }

  if (maketitleLine != null) {
    return maketitleLine + 1;
  }

  return beginDocIdx + 2;
}

export interface InsertAfterLinePlan {
  startLine: number;
  endLine: number;
  replace: string;
  insertLine: number;
}

/** Build replace_lines args to insert text after a given line (or before intro line). */
export function buildInsertAtLinePlan(
  content: string,
  insertLine: number,
  insertText: string,
  mode: "after" | "before" = "before"
): InsertAfterLinePlan | null {
  const lines = content.split("\n");
  const total = lines.length;
  if (insertLine < 1 || insertLine > total + 1) return null;

  if (mode === "before" && insertLine <= total) {
    const existing = lines[insertLine - 1] ?? "";
    const trimmedInsert = insertText.trimEnd();
    const needsLeadingNewline = trimmedInsert.length > 0 && !trimmedInsert.endsWith("\n");
    const prefix = needsLeadingNewline ? `${trimmedInsert}\n` : trimmedInsert;
    return {
      startLine: insertLine,
      endLine: insertLine,
      replace: prefix + existing,
      insertLine,
    };
  }

  const afterLine = Math.min(insertLine, total);
  const existing = lines[afterLine - 1] ?? "";
  const suffix = existing.length > 0 ? `${existing}\n${insertText}` : insertText;
  return {
    startLine: afterLine,
    endLine: afterLine,
    replace: suffix,
    insertLine: afterLine + 1,
  };
}

export function buildBodyContentInsertPlan(
  content: string,
  insertText: string,
  userMessage?: string
): InsertAfterLinePlan | null {
  const anchorIntent = userMessage ? detectInsertAnchorIntent(userMessage) : null;
  const insertLine = resolveBodyContentInsertLine(content, anchorIntent);
  if (insertLine == null) return null;

  const mode =
    anchorIntent === "before_introduction" && findIntroductionSectionLine(content) === insertLine
      ? "before"
      : "after";

  return buildInsertAtLinePlan(
    content,
    insertLine,
    insertText,
    mode === "before" ? "before" : "after"
  );
}

/** 1-based inclusive range of a misplaced body block before \\documentclass. */
export interface MisplacedBodyBlockRange {
  startLine: number;
  endLine: number;
  blockLines: string[];
}

const FLOAT_ENV_NAMES = ["table", "table*", "figure", "figure*", "tabular", "tabular*"];

function findEnvironmentEndLine(lines: string[], beginIdx: number, envName: string): number {
  const endMarker = `\\end{${envName}}`;
  for (let i = beginIdx; i < lines.length; i += 1) {
    if ((lines[i] ?? "").includes(endMarker)) return i;
  }
  return beginIdx;
}

function expandMisplacedBlockRange(
  lines: string[],
  startIdx: number,
  endIdx: number
): { startIdx: number; endIdx: number } {
  let start = startIdx;
  let end = endIdx;

  for (let i = start; i <= end; i += 1) {
    const line = lines[i] ?? "";
    for (const env of FLOAT_ENV_NAMES) {
      if (line.includes(`\\begin{${env}}`)) {
        const envEnd = findEnvironmentEndLine(lines, i, env);
        if (envEnd > end) end = envEnd;
      }
    }
  }

  while (start > 0 && isCommentOrBlankLine(lines[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < lines.length - 1 && isCommentOrBlankLine(lines[end + 1] ?? "")) {
    end += 1;
  }

  return { startIdx: start, endIdx: end };
}

export function findMisplacedBodyBlockBeforeDocumentClass(
  content: string
): MisplacedBodyBlockRange | null {
  const documentClassLine = getDocumentClassLine(content);
  if (documentClassLine == null) return null;

  const lines = content.split("\n");
  const beforeClass = lines.slice(0, documentClassLine - 1);
  if (beforeClass.every(isCommentOrBlankLine)) return null;

  let startIdx: number | null = null;
  let endIdx: number | null = null;

  for (let i = 0; i < beforeClass.length; i += 1) {
    const line = beforeClass[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;

    if (
      containsBodyManuscriptContent(line) ||
      BODY_FLOAT_BEGIN_RE.test(line) ||
      /\\end\{(?:table\*?|figure\*?|tabular\*?)\}/.test(line)
    ) {
      if (startIdx == null) startIdx = i;
      endIdx = i;
    }
  }

  if (startIdx == null || endIdx == null) return null;

  const expanded = expandMisplacedBlockRange(beforeClass, startIdx, endIdx);
  const blockLines = beforeClass.slice(expanded.startIdx, expanded.endIdx + 1);
  if (!containsBodyManuscriptContent(blockLines.join("\n"))) return null;

  return {
    startLine: expanded.startIdx + 1,
    endLine: expanded.endIdx + 1,
    blockLines,
  };
}

/** Misplaced body block before \\begin{document} when \\documentclass is already missing. */
export function findMisplacedBodyBlockBeforeBeginDocument(
  content: string
): MisplacedBodyBlockRange | null {
  const beginIdx = getBeginDocumentLineIndex(content);
  if (beginIdx == null) return null;

  const lines = content.split("\n");
  const beforeBegin = lines.slice(0, beginIdx);
  if (beforeBegin.every(isCommentOrBlankLine)) return null;

  let startIdx: number | null = null;
  let endIdx: number | null = null;

  for (let i = 0; i < beforeBegin.length; i += 1) {
    const line = beforeBegin[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;

    if (
      containsBodyManuscriptContent(line) ||
      BODY_FLOAT_BEGIN_RE.test(line) ||
      /\\end\{(?:table\*?|figure\*?|tabular\*?)\}/.test(line)
    ) {
      if (startIdx == null) startIdx = i;
      endIdx = i;
    }
  }

  if (startIdx == null || endIdx == null) return null;

  const expanded = expandMisplacedBlockRange(beforeBegin, startIdx, endIdx);
  const blockLines = beforeBegin.slice(expanded.startIdx, expanded.endIdx + 1);
  if (!containsBodyManuscriptContent(blockLines.join("\n"))) return null;

  return {
    startLine: expanded.startIdx + 1,
    endLine: expanded.endIdx + 1,
    blockLines,
  };
}

/** Misplaced body block before \\documentclass or \\begin{document}. */
export function findMisplacedBodyBlock(content: string): MisplacedBodyBlockRange | null {
  return (
    findMisplacedBodyBlockBeforeDocumentClass(content) ??
    findMisplacedBodyBlockBeforeBeginDocument(content)
  );
}

/** Reject edits that remove \\documentclass from a file that had it. */
export function validateDocumentClassPreserved(
  originalContent: string,
  previewContent: string
): LaTeXPreambleValidation {
  const originalClass = getDocumentClassLine(originalContent);
  const previewClass = getDocumentClassLine(previewContent);
  if (originalClass != null && previewClass == null) {
    return {
      ok: false,
      reason:
        "Edit would remove \\documentclass from the manuscript. " +
        "Never delete the document preamble (packages, title, authors) — remove only the misplaced body block.",
    };
  }
  return { ok: true };
}

/** Reject replace_lines that delete a large preamble span while moving body content. */
export function validateNoDestructivePreambleReplace(
  originalContent: string,
  startLine: number,
  endLine: number,
  replace: string,
  previewContent: string
): LaTeXPreambleValidation {
  const documentClassLine = getDocumentClassLine(originalContent);
  if (documentClassLine == null) return { ok: true };

  const beginDocIdx = getBeginDocumentLineIndex(originalContent);
  const beginDocLine = beginDocIdx != null ? beginDocIdx + 1 : null;

  const spansPreamble =
    startLine <= documentClassLine &&
    (beginDocLine == null || endLine >= documentClassLine);

  if (!spansPreamble) return { ok: true };

  const originalLines = originalContent.split("\n").slice(startLine - 1, endLine);
  const originalBlock = originalLines.join("\n");
  const hadPreambleMarkers =
    /\\documentclass\b/.test(originalBlock) ||
    /\\usepackage\b/.test(originalBlock) ||
    /\\author\b/.test(originalBlock) ||
    /\\title\b/.test(originalBlock);

  const replaceKeepsClass = /\\documentclass\b/.test(replace);
  const movingBodyOnly =
    containsBodyManuscriptContent(originalBlock) || containsBodyManuscriptContent(replace);

  if (hadPreambleMarkers && !replaceKeepsClass && movingBodyOnly) {
    return {
      ok: false,
      reason:
        "Edit would delete preamble lines (\\documentclass, packages, title, or authors) while moving body content. " +
        "Delete only the misplaced table or figure lines, then insert after \\end{abstract} or before \\section{Introduction}.",
    };
  }

  const preserved = validateDocumentClassPreserved(originalContent, previewContent);
  if (!preserved.ok) return preserved;

  const spanSize = endLine - startLine + 1;
  if (
    spanSize >= 10 &&
    startLine <= documentClassLine &&
    !replaceKeepsClass &&
    getDocumentClassLine(previewContent) == null
  ) {
    return {
      ok: false,
      reason:
        "Edit would replace a large preamble span and remove \\documentclass. " +
        "Do not edit the preamble unless the user asked to change packages, authors, or title.",
    };
  }

  return { ok: true };
}

export function validateNoBodyContentBeforeDocumentClass(content: string): LaTeXPreambleValidation {
  const documentClassLine = getDocumentClassLine(content);
  if (documentClassLine == null) return { ok: true };

  const lines = content.split("\n");
  for (let i = 0; i < documentClassLine - 1; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    if (containsBodyManuscriptContent(line)) {
      return {
        ok: false,
        reason:
          `Body content (table, figure, or section) appears before \\documentclass (line ${documentClassLine}). ` +
          "Move it after \\end{abstract} or before \\section{Introduction} — never before the preamble.",
      };
    }
  }

  const first = getFirstNonCommentLine(content);
  if (first && !isValidLaTeXFirstLine(first.text) && containsBodyManuscriptContent(first.text)) {
    return {
      ok: false,
      reason:
        "Body content would appear before \\documentclass. " +
        "Insert tables and figures after \\end{abstract}, not in the preamble.",
    };
  }

  return { ok: true };
}

export function isCursorInPreamble(content: string, cursorLine: number): boolean {
  const beginDocIdx = getBeginDocumentLineIndex(content);
  if (beginDocIdx == null) return cursorLine <= 1;
  return cursorLine <= beginDocIdx + 1;
}

export interface ValidateManuscriptEditOptions {
  originalContent: string;
  previewContent: string;
  replace: string;
  startLine?: number;
  endLine?: number;
}

/** Composite manuscript structure validation (manuscriptGuards, non compile-fix-only). */
export function validateManuscriptStructureEdit(
  options: ValidateManuscriptEditOptions
): LaTeXPreambleValidation {
  const { originalContent, previewContent, replace, startLine, endLine } = options;

  const classPreserved = validateDocumentClassPreserved(originalContent, previewContent);
  if (!classPreserved.ok) return classPreserved;

  const bodyBeforeClass = validateNoBodyContentBeforeDocumentClass(previewContent);
  if (!bodyBeforeClass.ok) return bodyBeforeClass;

  if (startLine != null && endLine != null) {
    const preambleCheck = validateNoDestructivePreambleReplace(
      originalContent,
      startLine,
      endLine,
      replace,
      previewContent
    );
    if (!preambleCheck.ok) return preambleCheck;
  }

  return { ok: true };
}

export function isPreambleMissing(content: string): boolean {
  return getDocumentClassLine(content) == null && getBeginDocumentLineIndex(content) != null;
}
