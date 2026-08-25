import { describe, expect, it } from "vitest";
import {
  buildForcedToolSystemPrompt,
  getComposerToolByName,
  listComposerToolOptions,
} from "./ai-composer-tools";

describe("ai-composer-tools", () => {
  it("lists enabled plugins and workspace read tools", () => {
    const options = listComposerToolOptions();
    expect(options.map((o) => o.toolName)).toEqual([
      "search_literature",
      "cite_from_doi",
      "search_arxiv",
      "parse_github_repo",
      "list_files",
      "get_file",
    ]);
    expect(options.map((o) => o.displayName)).toContain("Semantic Scholar");
    expect(options.map((o) => o.displayName)).toContain("Crossref");
    expect(options.map((o) => o.displayName)).toContain("arXiv");
    expect(options.map((o) => o.displayName)).toContain("GitHub");
    expect(options.map((o) => o.displayName)).toContain("List project files");
    expect(options.map((o) => o.displayName)).toContain("Read file");
  });

  it("provides placeholders for tools that need arguments", () => {
    expect(getComposerToolByName("cite_from_doi")?.placeholder).toContain("DOI");
    expect(getComposerToolByName("search_arxiv")?.placeholder).toContain("arXiv");
    expect(getComposerToolByName("parse_github_repo")?.placeholder).toContain("owner");
    expect(getComposerToolByName("get_file")?.placeholder).toContain("main.tex");
  });

  it("builds a forced-tool system prompt", () => {
    const prompt = buildForcedToolSystemPrompt("search_literature", "Semantic Scholar");
    expect(prompt).toContain("search_literature");
    expect(prompt).toContain("Semantic Scholar");
    expect(prompt).toContain("MUST call");
  });
});
