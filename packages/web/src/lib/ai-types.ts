/** Client-safe types for AI assistant API responses. */

import type { AiClientAction } from "@/lib/ai-client-actions";

export type { AiClientAction };

export type LiteratureSource = "semantic-scholar" | "openalex";
export type DoiCitationSource = "crossref" | "openalex";

export interface AiUsedPlugin {
  id: string;
  displayName: string;
  toolName: string;
  source?: LiteratureSource | DoiCitationSource | string;
}

export interface AiPaper {
  title: string;
  year: number | null;
  authors: string[];
  venue: string | null;
  doi: string | null;
  url: string | null;
  source: LiteratureSource;
}

export interface AiAppliedAction {
  label: string;
  type: AiClientAction["type"];
  file?: string;
}

export interface AiToolRead {
  label: string;
  path: string;
}

export interface AiChatResponse {
  content: string;
  usedPlugins?: AiUsedPlugin[];
  papers?: AiPaper[];
  doiCitations?: DoiCitationPayload[];
  arxivPapers?: ArxivPaperResult[];
  /** Editor actions for the client to apply (collab-safe via existing save paths). */
  actions?: AiClientAction[];
  appliedActions?: AiAppliedAction[];
  /** Small chips for get_file reads (not shown in the message bubble). */
  toolReads?: AiToolRead[];
}

export interface LiteratureToolPayload {
  kind: "literature-search";
  summary: string;
  query: string;
  source: LiteratureSource;
  papers: AiPaper[];
}

export interface DoiCitationPayload {
  kind: "doi-citation";
  summary: string;
  doi: string;
  title: string;
  citationKey: string;
  bibtex: string;
  source: DoiCitationSource;
}

export interface ArxivPaperResult {
  id: string;
  title: string;
  year: number | null;
  authors: string[];
  abstract: string | null;
  pdfUrl: string;
  sourceUrl: string;
}

export interface ArxivSearchPayload {
  kind: "arxiv-search";
  summary: string;
  query: string;
  papers: ArxivPaperResult[];
  error?: string;
}
