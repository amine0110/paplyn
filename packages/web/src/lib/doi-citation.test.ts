import { describe, expect, it } from "vitest";
import {
  DOI_REGEX,
  extractDoi,
  normalizeDoi,
  parseBibtexKey,
  parseBibtexTitle,
  resolveDoiCitation,
} from "./doi-citation";

describe("doi-citation", () => {
  it("recognizes bare and URL DOIs", () => {
    expect(normalizeDoi("10.1038/nature12373")).toBe("10.1038/nature12373");
    expect(normalizeDoi("https://doi.org/10.1038/nature12373")).toBe("10.1038/nature12373");
    expect(extractDoi("Please cite 10.1145/3295222.3295349 for details.")).toBe(
      "10.1145/3295222.3295349"
    );
  });

  it("matches DOI_REGEX", () => {
    expect("10.5555/abc".match(DOI_REGEX)?.[1]).toBe("10.5555/abc");
  });

  it("parses BibTeX key and title", () => {
    const entry = `@article{smith2024demo,\n  title = {A Demo Paper},\n}`;
    expect(parseBibtexKey(entry)).toBe("smith2024demo");
    expect(parseBibtexTitle(entry)).toBe("A Demo Paper");
  });

  it("returns 404 for unknown DOI from Crossref and OpenAlex", async () => {
    await expect(resolveDoiCitation("10.9999/not-a-real-doi-5031")).rejects.toMatchObject({
      message: expect.stringMatching(/not found|Failed/i),
    });
  });
});
