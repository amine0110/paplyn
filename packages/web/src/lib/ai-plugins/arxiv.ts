import { tool } from "ai";
import { z } from "zod";
import { ArxivError, formatArxivSearchForModel, searchArxiv } from "@/lib/arxiv";
import type { AiPlugin } from "./types";

const SYSTEM_PROMPT = `When the user asks to find arXiv papers, preprints, or mentions an arXiv ID:
- Call search_arxiv with a focused query (title, author, or arXiv ID).
- Results come from the official arXiv Atom API.
- Present title, authors, year, arXiv ID, and PDF link.
- Never invent arXiv papers or IDs.`;

export const arxivPlugin: AiPlugin = {
  id: "arxiv",
  name: "arXiv",
  description: "Search arXiv preprints via the official Atom API; open papers or cite BibTeX entries.",
  toolName: "search_arxiv",
  enabled: true,
  landing: {
    href: "https://arxiv.org/",
    wordmark: "arXiv",
    wordmarkClassName: "font-serif font-semibold tracking-tight",
    caption: "Preprint search & cite",
  },
  systemPrompt: SYSTEM_PROMPT,
  actionPrompts: {
    "find-papers":
      "When the user wants arXiv preprints or mentions arXiv, call search_arxiv with focused terms from their message. Summarize only real results.",
  },
  createTool: () =>
    tool({
      description:
        "Search arXiv for preprints by title, author, or arXiv ID using the official Atom API.",
      parameters: z.object({
        query: z
          .string()
          .describe("Search query: paper title, author name, or arXiv ID (e.g. 2301.12345)"),
      }),
      execute: async ({ query }) => {
        try {
          const searchResult = await searchArxiv(query);
          return {
            kind: "arxiv-search" as const,
            summary: formatArxivSearchForModel(searchResult),
            query: searchResult.query,
            papers: searchResult.papers.map((paper) => ({
              id: paper.id,
              title: paper.title,
              year: paper.year,
              authors: paper.authors,
              abstract: paper.abstract,
              pdfUrl: paper.pdfUrl,
              sourceUrl: paper.sourceUrl,
            })),
          };
        } catch (error) {
          const message =
            error instanceof ArxivError
              ? error.message
              : error instanceof Error
                ? error.message
                : "arXiv search failed";
          return {
            kind: "arxiv-search" as const,
            summary: message,
            query,
            papers: [],
            error: message,
          };
        }
      },
    }),
};
