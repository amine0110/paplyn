import { tool } from "ai";
import { z } from "zod";
import {
  formatZoteroSearchForModel,
  searchZoteroLibrary,
  type ZoteroCredentials,
  ZoteroError,
} from "@/lib/zotero";
import type { AiPlugin } from "./types";

const SYSTEM_PROMPT = `When the user asks to search their Zotero library or cite from Zotero:
- Call search_zotero with a focused query (title, author, or year).
- Results come from the user's personal Zotero library via the Zotero Web API.
- Present title, authors, year, and item key.
- Never invent Zotero items or keys.`;

export const zoteroPlugin: AiPlugin = {
  id: "zotero",
  name: "Zotero",
  description:
    "Search the user's personal Zotero library and cite BibTeX entries into the project bibliography.",
  toolName: "search_zotero",
  enabled: true,
  landing: {
    href: "https://www.zotero.org/",
    wordmark: "Zotero",
    wordmarkClassName: "font-semibold text-[#DB2C3A]",
    caption: "Your library → BibTeX",
  },
  systemPrompt: SYSTEM_PROMPT,
  actionPrompts: {
    "find-papers":
      "When the user wants papers from their Zotero library, call search_zotero with focused terms from their message. Summarize only real results.",
    citation:
      "When the user wants to cite from Zotero, call search_zotero to find matching library items before suggesting other sources.",
  },
  createTool: () => createZoteroTool(null),
};

export function createZoteroTool(credentials: ZoteroCredentials | null) {
  return tool({
    description:
      "Search the user's personal Zotero library by title, author, or year using the Zotero Web API.",
    parameters: z.object({
      query: z
        .string()
        .describe("Search query: paper title, author name, or keywords from the user's Zotero library"),
    }),
    execute: async ({ query }) => {
      if (!credentials) {
        return {
          kind: "zotero-search" as const,
          summary:
            "Zotero is not connected. Add your Zotero user ID and API key in Settings → Zotero.",
          query,
          items: [],
          error: "Zotero credentials missing",
        };
      }

      try {
        const searchResult = await searchZoteroLibrary(credentials, query);
        return {
          kind: "zotero-search" as const,
          summary: formatZoteroSearchForModel(searchResult),
          query: searchResult.query,
          items: searchResult.items.map((item) => ({
            itemKey: item.itemKey,
            title: item.title,
            year: item.year,
            authors: item.authors,
            itemType: item.itemType,
          })),
        };
      } catch (error) {
        const message =
          error instanceof ZoteroError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Zotero search failed";
        return {
          kind: "zotero-search" as const,
          summary: message,
          query,
          items: [],
          error: message,
        };
      }
    },
  });
}
