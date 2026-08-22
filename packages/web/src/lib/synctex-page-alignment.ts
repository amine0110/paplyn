/**
 * PDF page ↔ SyncTeX page alignment.
 *
 * pdflatex numbers SyncTeX pages in `{n` … `}n` records. These usually match PDF
 * physical pages 1…N from the same compile, but can diverge when:
 * - PDF and synctex come from different compiles (web bug: synctex updated on failure)
 * - PDF gains leading blank pages (e.g. stray `beleive` token) while synctex is stale
 */

import type { SynctexBlock, SynctexIndex } from "./synctex";

/** Source line at or above this is treated as document body (sections), not preamble. */
export const SYNCTEX_BODY_LINE_THRESHOLD = 30;

export interface SynctexPageSummary {
  synctexPage: number;
  blockCount: number;
  minLine: number;
  maxLine: number;
  uniqueLines: number[];
  /** True when any block line is >= SYNCTEX_BODY_LINE_THRESHOLD */
  hasBodyContent: boolean;
  /** True when preamble lines (<=11) appear and no body content */
  preambleOnly: boolean;
}

export interface SynctexPdfAlignmentReport {
  pdfPageCount: number;
  synctexPageNumbers: number[];
  synctexPageCount: number;
  pageSummaries: SynctexPageSummary[];
  /** PDF viewer page (1-based) → synctex page to search in `pageBlocks` */
  pdfToSynctexPage: Record<number, number>;
  /** True when pdfPageCount === synctexPageCount and 1:1 body-page mapping holds */
  countsMatch: boolean;
  introductionLine: number | null;
  introductionSynctexPage: number | null;
  mismatchReason: string | null;
}

/** Parse `{n` / `}n` page open/close records from raw SyncTeX text. */
export function listSynctexPageRecords(text: string): { open: number[]; close: number[] } {
  const open: number[] = [];
  const close: number[] = [];
  for (const line of text.split("\n")) {
    const openMatch = line.match(/^\{(\d+)$/);
    if (openMatch) {
      open.push(parseInt(openMatch[1], 10));
      continue;
    }
    const closeMatch = line.match(/^\}(\d+)$/);
    if (closeMatch) close.push(parseInt(closeMatch[1], 10));
  }
  return { open, close };
}

export function getSynctexPageNumbers(index: SynctexIndex): number[] {
  return Object.keys(index.pageBlocks)
    .map((p) => parseInt(p, 10))
    .filter((p) => !Number.isNaN(p))
    .sort((a, b) => a - b);
}

export function summarizeSynctexPage(index: SynctexIndex, synctexPage: number): SynctexPageSummary {
  const blocks = index.pageBlocks[synctexPage] ?? [];
  const uniqueLines = [...new Set(blocks.map((b) => b.line))].sort((a, b) => a - b);
  const minLine = uniqueLines[0] ?? 0;
  const maxLine = uniqueLines[uniqueLines.length - 1] ?? 0;
  const hasBodyContent = uniqueLines.some((l) => l >= SYNCTEX_BODY_LINE_THRESHOLD);
  const preambleOnly =
    uniqueLines.length > 0 &&
    uniqueLines.every((l) => l <= 11) &&
    !hasBodyContent;

  return {
    synctexPage: synctexPage,
    blockCount: blocks.length,
    minLine,
    maxLine,
    uniqueLines,
    hasBodyContent,
    preambleOnly,
  };
}

/** Which synctex page contains a given source line (first match). */
export function findSynctexPageForLine(index: SynctexIndex, line: number): number | null {
  for (const synctexPage of getSynctexPageNumbers(index)) {
    if (index.pageBlocks[synctexPage]?.some((b) => b.line === line)) {
      return synctexPage;
    }
  }
  return null;
}

/** Lines from `candidates` that appear in any synctex page block. */
export function linesWithSynctexBlocks(index: SynctexIndex, candidates: number[]): number[] {
  return candidates.filter((line) => findSynctexPageForLine(index, line) !== null);
}

/**
 * Map PDF viewer page → synctex `pageBlocks` key.
 *
 * When counts match, uses 1:1 mapping. When PDF has more pages than synctex
 * (stale single-page synctex + multi-page PDF), offsets so the last PDF pages
 * align with available synctex pages.
 */
export function buildPdfToSynctexPageMap(
  pdfPageCount: number,
  index: SynctexIndex
): Record<number, number> {
  const synctexPages = getSynctexPageNumbers(index);
  const map: Record<number, number> = {};

  if (pdfPageCount <= 0 || synctexPages.length === 0) return map;

  if (pdfPageCount === synctexPages.length) {
    for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
      map[pdfPage] = pdfPage;
    }
    return map;
  }

  if (pdfPageCount > synctexPages.length) {
    const offset = pdfPageCount - synctexPages.length;
    const maxSynctex = synctexPages[synctexPages.length - 1];
    for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
      const mapped = pdfPage - offset;
      map[pdfPage] = Math.max(1, Math.min(mapped, maxSynctex));
    }
    return map;
  }

  // More synctex pages than PDF pages (unusual): clamp to last synctex page.
  const maxSynctex = synctexPages[synctexPages.length - 1];
  for (let pdfPage = 1; pdfPage <= pdfPageCount; pdfPage++) {
    map[pdfPage] = Math.min(pdfPage, maxSynctex);
  }
  return map;
}

export function mapPdfPageToSynctexPage(
  pdfPage: number,
  pdfPageCount: number,
  index: SynctexIndex
): number {
  const map = buildPdfToSynctexPageMap(pdfPageCount, index);
  return map[pdfPage] ?? pdfPage;
}

export function analyzeSynctexPdfAlignment(
  pdfPageCount: number,
  index: SynctexIndex,
  options: { introductionLine?: number } = {}
): SynctexPdfAlignmentReport {
  const synctexPageNumbers = getSynctexPageNumbers(index);
  const pageSummaries = synctexPageNumbers.map((p) => summarizeSynctexPage(index, p));
  const pdfToSynctexPage = buildPdfToSynctexPageMap(pdfPageCount, index);
  const countsMatch = pdfPageCount === synctexPageNumbers.length;

  const introductionLine = options.introductionLine ?? null;
  const introductionSynctexPage =
    introductionLine !== null ? findSynctexPageForLine(index, introductionLine) : null;

  let mismatchReason: string | null = null;
  if (!countsMatch) {
    mismatchReason = `PDF has ${pdfPageCount} page(s) but synctex has ${synctexPageNumbers.length} page record(s): [${synctexPageNumbers.join(", ")}]`;
  }

  return {
    pdfPageCount,
    synctexPageNumbers,
    synctexPageCount: synctexPageNumbers.length,
    pageSummaries,
    pdfToSynctexPage,
    countsMatch,
    introductionLine,
    introductionSynctexPage,
    mismatchReason,
  };
}

/** Lines that appear only on synctex page 1 in the production-layout 2-page fixture. */
export function preambleLinesOnSynctexPage(index: SynctexIndex, synctexPage: number): number[] {
  const PREAMBLE = [5, 6, 7, 8, 9, 10, 11];
  return PREAMBLE.filter((line) =>
    index.pageBlocks[synctexPage]?.some((b: SynctexBlock) => b.line === line)
  );
}
