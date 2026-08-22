import { tool } from "ai";
import { z } from "zod";
import { formatLiteratureSearchForModel, searchLiterature } from "@/lib/ai-literature-search";
import type { AiPlugin } from "./types";

const SYSTEM_PROMPT = `When the user asks for papers, related work, literature, or citations:
- Call the search_literature tool with a focused academic query.
- Cite only papers returned by the tool. Never invent titles, authors, DOIs, or venues.
- Present results as markdown bullets: title, year, authors, venue, citation count, one-line relevance, and DOI/url.
- If the tool reports a failure or no results, say so plainly and do not fabricate a bibliography.`;

export const semanticScholarPlugin: AiPlugin = {
  id: "semantic-scholar",
  name: "Semantic Scholar",
  description: "Search academic papers via the Semantic Scholar Graph API (OpenAlex fallback).",
  toolName: "search_literature",
  enabled: true,
  landing: {
    href: "https://www.semanticscholar.org/",
    wordmark: "Semantic Scholar",
    wordmarkClassName: "font-semibold text-[#1857B6]",
    caption: "Literature search",
  },
  systemPrompt: SYSTEM_PROMPT,
  actionPrompts: {
    "find-papers":
      "The user wants related academic papers. Search literature with search_literature using terms from their project topic, selection, or latest message. Summarize only real search results.",
  },
  createTool: () =>
    tool({
      description:
        "Search Semantic Scholar for academic papers. Use when the user asks for related work, literature, citations, or references.",
      parameters: z.object({
        query: z
          .string()
          .describe(
            "Focused academic search query, e.g. topic + method or key terms from the manuscript"
          ),
      }),
      execute: async ({ query }) => {
        const searchResult = await searchLiterature(query);
        return formatLiteratureSearchForModel(searchResult);
      },
    }),
};
