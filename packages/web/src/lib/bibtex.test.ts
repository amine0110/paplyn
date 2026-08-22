import { describe, expect, it } from "vitest";
import type { AiPaper } from "@/lib/ai-types";
import {
  appendBibEntry,
  formatBibtexEntry,
  parseBibKeys,
  resolveProjectBibPath,
  suggestCitationKey,
} from "./bibtex";

const samplePaper: AiPaper = {
  title: "Attention Is All You Need",
  year: 2017,
  authors: ["Ashish Vaswani", "Noam Shazeer"],
  venue: "NeurIPS",
  doi: "10.5555/3295222.3295349",
  url: "https://example.com/paper",
  source: "semantic-scholar",
};

describe("bibtex helpers", () => {
  it("parses existing citation keys from bib content", () => {
    const keys = parseBibKeys(`@article{smith2020,\n  title = {A}\n}\n@book{jones2019, title={B}}`);
    expect(keys).toEqual(new Set(["smith2020", "jones2019"]));
  });

  it("suggests authorYearTitle-ish keys and avoids collisions", () => {
    const existing = new Set(["vaswani2017attentionisall"]);
    const key = suggestCitationKey(samplePaper, existing);
    expect(key).toMatch(/^vaswani2017/);
    expect(existing.has(key)).toBe(false);
  });

  it("formats bibtex from paper metadata without inventing fields", () => {
    const entry = formatBibtexEntry(samplePaper, "vaswani2017attention");
    expect(entry).toContain("@article{vaswani2017attention,");
    expect(entry).toContain("title = {Attention Is All You Need}");
    expect(entry).toContain("author = {Ashish Vaswani and Noam Shazeer}");
    expect(entry).toContain("year = {2017}");
    expect(entry).toContain("journal = {NeurIPS}");
    expect(entry).toContain("doi = {10.5555/3295222.3295349}");
    expect(entry).not.toContain("publisher");
  });

  it("appends a new entry without duplicating keys", () => {
    const bib = "@article{existing, title={Old}}\n";
    const entry = formatBibtexEntry(samplePaper, "existing");
    expect(appendBibEntry(bib, entry, "existing")).toBe(bib);

    const appended = appendBibEntry(bib, formatBibtexEntry(samplePaper, "vaswani2017"), "vaswani2017");
    expect(appended).toContain("@article{existing");
    expect(appended).toContain("@article{vaswani2017");
  });

  it("resolves bib path from bibliography command in main tex", () => {
    const path = resolveProjectBibPath({
      mainFile: "main.tex",
      filePaths: ["main.tex", "refs.bib", "other.bib"],
      fileContents: {
        "main.tex": "\\bibliography{refs}\n",
        "refs.bib": "",
        "other.bib": "",
      },
    });
    expect(path).toBe("refs.bib");
  });

  it("falls back to references.bib when no bib file exists", () => {
    const path = resolveProjectBibPath({
      mainFile: "main.tex",
      filePaths: ["main.tex"],
      fileContents: { "main.tex": "\\begin{document}\n" },
    });
    expect(path).toBe("references.bib");
  });
});
