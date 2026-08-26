import { describe, it, expect } from "vitest";
import {
  checkPersistConcatenationGuard,
  countBibEntryKeys,
  countDocumentClassLines,
  countDuplicateBibKeys,
  extractFirstLaTeXCopy,
  hasMultipleDocumentCopies,
  isSuspiciousSizeJump,
} from "./document-integrity.js";

const SAMPLE =
  "\\documentclass{article}\n\\begin{document}\nHello world\n\\end{document}\n";

describe("document-integrity", () => {
  it("detects multiple documentclass lines in concatenated LaTeX", () => {
    const bloated = SAMPLE.repeat(220);
    expect(countDocumentClassLines(SAMPLE)).toBe(1);
    expect(countDocumentClassLines(bloated)).toBe(220);
    expect(hasMultipleDocumentCopies(bloated)).toBe(true);
  });

  it("extractFirstLaTeXCopy returns a single preamble/body", () => {
    const bloated = SAMPLE.repeat(3);
    const firstCopy = extractFirstLaTeXCopy(bloated);
    expect(firstCopy).toContain("\\documentclass{article}");
    expect(firstCopy).toContain("\\end{document}");
    expect(countDocumentClassLines(firstCopy)).toBe(1);
  });

  it("isSuspiciousSizeJump flags llm-similarity-scale growth", () => {
    const cleanLength = 1209;
    const bloatedLength = 312_573;
    expect(isSuspiciousSizeJump(cleanLength, bloatedLength)).toBe(true);
    expect(isSuspiciousSizeJump(cleanLength, cleanLength + 10)).toBe(false);
  });

  it("checkPersistConcatenationGuard blocks 220-copy upsert over clean HTTP", () => {
    const clean = SAMPLE;
    const bloated = SAMPLE.repeat(220);
    const result = checkPersistConcatenationGuard("main.tex", clean, bloated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.documentClassCount).toBe(220);
      expect(result.existingDocumentClassCount).toBe(1);
    }
  });

  it("checkPersistConcatenationGuard allows legitimate single-copy edits", () => {
    const existing = SAMPLE;
    const edited = SAMPLE.replace("Hello world", "Hello universe");
    expect(checkPersistConcatenationGuard("main.tex", existing, edited).ok).toBe(true);
  });

  it("checkPersistConcatenationGuard blocks doubled .bib with duplicate keys", () => {
    const single = "@article{smith2024,\n  title={One}\n}\n";
    const doubled = single + single;
    expect(countBibEntryKeys(single)).toBe(1);
    expect(countBibEntryKeys(doubled)).toBe(2);
    expect(countDuplicateBibKeys(doubled)).toBe(1);

    const result = checkPersistConcatenationGuard("references.bib", single, doubled);
    expect(result.ok).toBe(false);
  });
});
