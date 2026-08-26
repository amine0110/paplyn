import { describe, expect, it } from "vitest";
import {
  formatArxivBibtexEntry,
  normalizeArxivId,
  parseArxivAtomFeed,
  searchArxiv,
} from "./arxiv";

const SAMPLE_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>Sample arXiv Paper</title>
    <published>2023-01-01T00:00:00Z</published>
    <summary>An example abstract.</summary>
    <author><name>Ada Lovelace</name></author>
    <author><name>Alan Turing</name></author>
    <link href="https://arxiv.org/abs/2301.00001" rel="alternate" type="text/html"/>
    <link href="https://arxiv.org/pdf/2301.00001" rel="related" type="application/pdf"/>
  </entry>
</feed>`;

describe("arxiv", () => {
  it("normalizes arXiv IDs from URLs and bare ids", () => {
    expect(normalizeArxivId("2301.00001")).toBe("2301.00001");
    expect(normalizeArxivId("https://arxiv.org/abs/2301.00001")).toBe("2301.00001");
    expect(normalizeArxivId("arxiv:2301.00001v2")).toBe("2301.00001v2");
  });

  it("parses Atom feed entries", () => {
    const papers = parseArxivAtomFeed(SAMPLE_ATOM);
    expect(papers).toHaveLength(1);
    expect(papers[0]?.title).toBe("Sample arXiv Paper");
    expect(papers[0]?.id).toBe("2301.00001");
    expect(papers[0]?.authors).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(papers[0]?.year).toBe(2023);
  });

  it("formats arXiv BibTeX entries with eprint metadata", () => {
    const papers = parseArxivAtomFeed(SAMPLE_ATOM);
    const paper = papers[0]!;
    const entry = formatArxivBibtexEntry(paper, "lovelace2023sample");
    expect(entry).toContain("@article{lovelace2023sample,");
    expect(entry).toContain("title = {Sample arXiv Paper}");
    expect(entry).toContain("author = {Ada Lovelace and Alan Turing}");
    expect(entry).toContain("year = {2023}");
    expect(entry).toContain("eprint = {2301.00001}");
    expect(entry).toContain("archivePrefix = {arXiv}");
    expect(entry).toContain("url = {https://arxiv.org/abs/2301.00001}");
  });

  it("searches arXiv by id via the official API", async () => {
    const result = await searchArxiv("1706.03762", 1);
    expect(result.papers.length).toBeGreaterThan(0);
    expect(result.papers[0]?.title.toLowerCase()).toContain("attention");
  }, 20_000);
});
