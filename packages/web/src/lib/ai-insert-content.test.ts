import { describe, expect, it } from "vitest";
import { extractInsertableContent } from "./ai-insert-content";
import { formatLiteratureSearchForModel } from "./ai-literature-search";
import type { LiteraturePaper, LiteratureSearchResult } from "./ai-literature-search";

describe("extractInsertableContent", () => {
  it("extracts fenced latex blocks when present", () => {
    const content = `Here is a fix:

\`\`\`latex
\\section{Intro}
Hello world.
\`\`\`

Let me know if you need more.`;

    expect(extractInsertableContent(content)).toBe("\\section{Intro}\nHello world.");
  });

  it("joins multiple latex blocks", () => {
    const content = `\`\`\`tex
\\textbf{A}
\`\`\`

\`\`\`latex
\\textbf{B}
\`\`\``;

    expect(extractInsertableContent(content)).toBe("\\textbf{A}\n\n\\textbf{B}");
  });

  it("returns raw content when no latex fences exist", () => {
    const content = "Use \\cite{smith2020} in your bibliography.";
    expect(extractInsertableContent(content)).toBe(content);
  });
});

describe("formatLiteratureSearchForModel", () => {
  const paper: LiteraturePaper = {
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

  it("formats successful search results", () => {
    const result: LiteratureSearchResult = {
      query: "transformer attention",
      papers: [paper],
      source: "semantic-scholar",
    };
    const text = formatLiteratureSearchForModel(result);
    expect(text).toContain("Attention Is All You Need");
    expect(text).toContain("NeurIPS");
    expect(text).toContain("doi.org/10.5555");
    expect(text).toContain("Cite only these real results");
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

  it("handles empty result sets", () => {
    const result: LiteratureSearchResult = {
      query: "zzzznonexistenttopic12345",
      papers: [],
      source: "semantic-scholar",
    };
    const text = formatLiteratureSearchForModel(result);
    expect(text).toContain("No papers found");
  });
});
