/** Detect and relocate bibliography blocks placed before abstract/body. */

import {
  findBibliographyAnchorLineNumbers,
  findBibliographySiteRanges,
  formatCompileFixLineChangeSummary,
  getBeginDocumentLineIndex,
  getFirstLaTeXCopyEndLine,
  validateBibliographyStructure,
  type BibliographySiteRange,
} from "@/lib/ai-compile-fix-validation";
import type { AiClientAction } from "@/lib/ai-client-actions";
import {
  ABSTRACT_BEGIN_RE,
  ABSTRACT_CMD_RE,
  detectManuscriptStructureConcern,
  detectReferencesRecoveryIntent,
} from "./ai-compile-fix-bibliography-recovery-patterns";

export {
  detectManuscriptStructureConcern,
  detectReferencesRecoveryIntent,
  isMisplacedBibliographyStructure,
} from "./ai-compile-fix-bibliography-recovery-patterns";

export type { BibliographySiteRange };

function isCommentOrBlankLine(line: string): boolean {
  const trimmed = line.trim();
  return !trimmed || trimmed.startsWith("%");
}

function findAbstractLine(content: string): number | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const bodyStart = getBeginDocumentLineIndex(content);
  const start = bodyStart != null ? bodyStart + 1 : 0;

  for (let i = start; i < firstCopyEnd; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    if (ABSTRACT_BEGIN_RE.test(line) || ABSTRACT_CMD_RE.test(line)) {
      return i + 1;
    }
  }
  return null;
}

function findEndDocumentLine(content: string): number | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);

  for (let i = 0; i < firstCopyEnd; i += 1) {
    const line = lines[i] ?? "";
    if (isCommentOrBlankLine(line)) continue;
    if (line.includes("\\end{document}")) return i + 1;
  }
  return null;
}

/** First bibliography site that sits before abstract or the first body anchor. */
export function getMisplacedBibliographySite(content: string): BibliographySiteRange | null {
  const structure = validateBibliographyStructure(content);
  if (structure.ok) return null;

  const ranges = findBibliographySiteRanges(content);
  if (ranges.length === 0) return null;

  const abstractLine = findAbstractLine(content);
  const anchors = findBibliographyAnchorLineNumbers(content);
  const boundary =
    abstractLine ??
    anchors.find((line) => {
      const text = content.split("\n")[line - 1] ?? "";
      return /\\section\*?\{/.test(text) && !/\\section\*?\{(?:References|Bibliography)\}/i.test(text);
    }) ??
    null;

  if (boundary == null) {
    if (!structure.ok && /duplicate|front matter|before later body/i.test(structure.reason)) {
      return ranges[0] ?? null;
    }
    return null;
  }

  const misplaced = ranges.find((range) => range.startLine < boundary);
  return misplaced ?? null;
}

export interface BibliographyRelocationPlan {
  file: string;
  removeStart: number;
  removeEnd: number;
  blockLines: string[];
  endDocumentLine: number;
  /** When true, relocate before \\end{document}; otherwise append at EOF. */
  hasEndDocument: boolean;
  /** When true, a bibliography already exists after the body — only remove the top block. */
  removeOnly: boolean;
  previewContent: string;
}

export function buildBibliographyRelocationPlan(
  file: string,
  content: string
): BibliographyRelocationPlan | null {
  const misplaced = getMisplacedBibliographySite(content);
  if (!misplaced) return null;

  const lines = content.split("\n");
  const endDocumentLine = findEndDocumentLine(content);
  const hasEndDocument = endDocumentLine != null;
  const insertionLine = hasEndDocument ? endDocumentLine! : lines.length;

  const blockLines = lines.slice(misplaced.startLine - 1, misplaced.endLine);
  const withoutMisplaced = [
    ...lines.slice(0, misplaced.startLine - 1),
    ...lines.slice(misplaced.endLine),
  ];
  const remainingRanges = findBibliographySiteRanges(withoutMisplaced.join("\n"));
  const removeOnly = remainingRanges.length > 0;

  let previewContent: string;
  if (removeOnly) {
    previewContent = withoutMisplaced.join("\n");
  } else if (hasEndDocument) {
    const endIdx = insertionLine - 1;
    const removedLineCount = misplaced.endLine - misplaced.startLine;
    const adjustedEndIdx =
      endIdx >= misplaced.startLine ? endIdx - removedLineCount : endIdx;
    const endLine = withoutMisplaced[adjustedEndIdx] ?? "\\end{document}";
    previewContent = [
      ...withoutMisplaced.slice(0, adjustedEndIdx),
      ...blockLines,
      endLine,
      ...withoutMisplaced.slice(adjustedEndIdx + 1),
    ].join("\n");
  } else {
    previewContent = [...withoutMisplaced, ...blockLines].join("\n");
  }

  if (!validateBibliographyStructure(previewContent).ok) return null;

  return {
    file,
    removeStart: misplaced.startLine,
    removeEnd: misplaced.endLine,
    blockLines,
    endDocumentLine: insertionLine,
    hasEndDocument,
    removeOnly,
    previewContent,
  };
}

export function buildBibliographyRelocationActions(
  plan: BibliographyRelocationPlan,
  content: string
): AiClientAction[] {
  const lines = content.split("\n");

  if (plan.removeOnly) {
    return [
      {
        type: "replace_lines",
        file: plan.file,
        startLine: plan.removeStart,
        endLine: plan.removeEnd,
        replace: "",
        label: `Removed duplicate references near top of ${plan.file}`,
      },
    ];
  }

  if (plan.hasEndDocument) {
    const replace = [
      ...lines.slice(plan.removeEnd, plan.endDocumentLine - 1),
      ...plan.blockLines,
      lines[plan.endDocumentLine - 1] ?? "\\end{document}",
    ].join("\n");

    return [
      {
        type: "replace_lines",
        file: plan.file,
        startLine: plan.removeStart,
        endLine: plan.endDocumentLine,
        replace,
        label: `Moved references to end of ${plan.file}`,
      },
    ];
  }

  const replace = [...lines.slice(plan.removeEnd), ...plan.blockLines].join("\n");

  return [
    {
      type: "replace_lines",
      file: plan.file,
      startLine: plan.removeStart,
      endLine: lines.length,
      replace,
      label: `Moved references to end of ${plan.file}`,
    },
  ];
}

export function buildBibliographyRecoveryMessage(plan: BibliographyRelocationPlan): string {
  const removedRange =
    plan.removeStart === plan.removeEnd
      ? `line ${plan.removeStart}`
      : `lines ${plan.removeStart}–${plan.removeEnd}`;

  const changeSummary = formatCompileFixLineChangeSummary({
    file: plan.file,
    startLine: plan.removeStart,
    endLine: plan.removeEnd,
  });

  if (plan.removeOnly) {
    return (
      `${changeSummary} Removed a duplicate references block at the top of the manuscript ` +
      `(${removedRange}). The bibliography at the end was kept. Recompile to verify the PDF.`
    );
  }

  if (plan.hasEndDocument) {
    return (
      `${changeSummary} Moved the references block from ${removedRange} to the end of the document, ` +
      `before \\end{document}. Recompile to verify the PDF.`
    );
  }

  return (
    `${changeSummary} Moved the references block from ${removedRange} to the end of ${plan.file}. ` +
    `Recompile to verify the PDF.`
  );
}

export function buildBibliographyRecoveryNotFoundMessage(texFiles: Iterable<string>): string {
  const paths = [...texFiles].sort();
  const fileList = paths.length > 0 ? paths.join(", ") : "project .tex files";
  return `Checked ${fileList} for a misplaced references block but did not find one to move.`;
}

function hasMisplacedBibliographyInTexFiles(texFiles: Map<string, string>): boolean {
  for (const content of texFiles.values()) {
    if (getMisplacedBibliographySite(content)) return true;
  }
  return false;
}

export function tryBibliographyRecovery(options: {
  texFiles: Map<string, string>;
  mainFile: string;
  compileFixRequest: boolean;
  userMessage: string;
}): { actions: AiClientAction[]; message: string; previewContent: string; file: string } | null {
  const misplacedBibliography = hasMisplacedBibliographyInTexFiles(options.texFiles);
  const shouldRecover =
    options.compileFixRequest ||
    detectReferencesRecoveryIntent(options.userMessage) ||
    (misplacedBibliography && detectManuscriptStructureConcern(options.userMessage));
  if (!shouldRecover) return null;

  const orderedPaths = [
    options.mainFile,
    ...[...options.texFiles.keys()].filter((path) => path !== options.mainFile).sort(),
  ];

  for (const file of orderedPaths) {
    const content = options.texFiles.get(file);
    if (content == null) continue;

    const plan = buildBibliographyRelocationPlan(file, content);
    if (!plan) continue;

    return {
      actions: buildBibliographyRelocationActions(plan, content),
      message: buildBibliographyRecoveryMessage(plan),
      previewContent: plan.previewContent,
      file,
    };
  }

  return null;
}
