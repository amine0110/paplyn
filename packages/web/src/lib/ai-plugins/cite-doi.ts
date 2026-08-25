import { tool } from "ai";
import { z } from "zod";
import { DoiCitationError, extractDoi, normalizeDoi, resolveDoiCitation } from "@/lib/doi-citation";
import type { AiPlugin } from "./types";

const SYSTEM_PROMPT = `When the user pastes or mentions a DOI (format 10.xxxx/...):
- Call cite_from_doi with the DOI string.
- Do not invent bibliographic metadata. Only cite DOIs resolved by the tool.
- Confirm the resolved title in your reply.
- If the tool reports an error, say the DOI could not be resolved.`;

export const citeDoiPlugin: AiPlugin = {
  id: "cite-doi",
  name: "Crossref",
  description: "Resolve DOIs to BibTeX via Crossref (OpenAlex fallback) and add them to the project bibliography.",
  toolName: "cite_from_doi",
  enabled: true,
  landing: {
    href: "https://www.crossref.org/",
    wordmark: "Crossref",
    wordmarkClassName: "font-semibold text-[#3EB1C8]",
    caption: "DOI → BibTeX",
  },
  systemPrompt: SYSTEM_PROMPT,
  actionPrompts: {
    citation:
      "If the user message contains a DOI, call cite_from_doi before suggesting other literature. Confirm the resolved title.",
  },
  createTool: () =>
    tool({
      description:
        "Resolve a DOI to BibTeX using Crossref (OpenAlex fallback). Use when the user pastes or mentions a DOI (10.xxxx/...).",
      parameters: z.object({
        doi: z.string().describe("DOI string, e.g. 10.1038/nature12373"),
      }),
      execute: async ({ doi }) => {
        try {
          const resolved = await resolveDoiCitation(doi);
          return {
            kind: "doi-citation" as const,
            summary: `Resolved DOI ${resolved.doi}: ${resolved.title}`,
            doi: resolved.doi,
            title: resolved.title,
            citationKey: resolved.citationKey,
            bibtex: resolved.bibtex,
            source: resolved.source,
          };
        } catch (error) {
          const message =
            error instanceof DoiCitationError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to resolve DOI";
          return {
            kind: "doi-citation-error" as const,
            summary: message,
            doi: normalizeDoi(doi) ?? extractDoi(doi) ?? doi,
            error: message,
          };
        }
      },
    }),
};
