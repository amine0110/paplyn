import { describe, expect, it } from "vitest";
import {
  buildRecencyNote,
  dedupeLiteraturePapers,
  formatLiteratureSearchForModel,
  rankPapersForLiteratureReview,
} from "./ai-literature-search";
import type { LiteraturePaper, LiteratureSearchResult } from "./ai-literature-search";

function paper(overrides: Partial<LiteraturePaper> & Pick<LiteraturePaper, "title" | "year">): LiteraturePaper {
  return {
    authors: ["A. Author"],
    venue: "Venue",
    citationCount: 10,
    abstract: null,
    tldr: null,
    doi: null,
    url: null,
    source: "semantic-scholar",
    ...overrides,
  };
}

describe("rankPapersForLiteratureReview", () => {
  it("surfaces recent papers before older classics", () => {
    const ranked = rankPapersForLiteratureReview(
      [
        paper({ title: "Classic", year: 2012, citationCount: 50000 }),
        paper({ title: "Recent", year: 2024, citationCount: 20 }),
        paper({ title: "Mid", year: 2019, citationCount: 200 }),
      ],
      { nowYear: 2026, limit: 3 }
    );

    expect(ranked.map((p) => p.title)).toEqual(["Recent", "Mid", "Classic"]);
  });

  it("deduplicates by DOI when merging supplemental recent search", () => {
    const duped = dedupeLiteraturePapers([
      paper({ title: "Same paper", year: 2024, doi: "10.1234/abc" }),
      paper({ title: "Same Paper", year: 2023, doi: "10.1234/abc" }),
    ]);
    expect(duped).toHaveLength(1);
  });
});

describe("buildRecencyNote", () => {
  it("warns when no papers fall within the recent window", () => {
    const note = buildRecencyNote([paper({ title: "Old", year: 2012 })], {
      nowYear: 2026,
      recentYearWindow: 5,
    });
    expect(note).toContain("No papers from 2021–2026");
    expect(note).toContain("do not invent");
  });

  it("returns undefined when recent papers are present", () => {
    const note = buildRecencyNote([paper({ title: "Fresh", year: 2025 })], { nowYear: 2026 });
    expect(note).toBeUndefined();
  });
});

describe("formatLiteratureSearchForModel", () => {
  const sample: LiteraturePaper = {
    title: "Attention Is All You Need",
    year: 2017,
    authors: ["Vaswani", "Shazeer", "Parmar"],
    venue: "NeurIPS",
    citationCount: 100000,
    abstract: "We propose the Transformer architecture.",
    tldr: "Transformers replace recurrence with attention.",
    doi: "10.5555/3295222.3295349",
    url: "https://www.semanticscholar.org/paper/abc",
    source: "semantic-scholar",
  };

  it("formats successful search results with live-search wording", () => {
    const result: LiteratureSearchResult = {
      query: "transformer attention",
      papers: [sample],
      source: "semantic-scholar",
    };
    const text = formatLiteratureSearchForModel(result);
    expect(text).toContain("live semantic-scholar search");
    expect(text).toContain("Attention Is All You Need");
    expect(text).toContain("(2017)");
  });

  it("includes recency note when provided", () => {
    const result: LiteratureSearchResult = {
      query: "topic",
      papers: [sample],
      source: "semantic-scholar",
      recencyNote: "No papers from 2021–2026 appeared in these live search results.",
    };
    const text = formatLiteratureSearchForModel(result);
    expect(text).toContain("No papers from 2021–2026");
  });

  it("reports search failures plainly", () => {
    const result: LiteratureSearchResult = {
      query: "foo",
      papers: [],
      source: "semantic-scholar",
      error: "Semantic Scholar search failed (503)",
    };
    const text = formatLiteratureSearchForModel(result);
    expect(text).toContain("Literature search failed");
    expect(text).toContain("Do not invent");
  });
});
