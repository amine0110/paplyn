/** Client-safe types for AI assistant API responses. */

export type LiteratureSource = "semantic-scholar" | "openalex";

export interface AiUsedPlugin {
  id: string;
  displayName: string;
  toolName: string;
  source?: LiteratureSource;
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

export interface AiChatResponse {
  content: string;
  usedPlugins?: AiUsedPlugin[];
  papers?: AiPaper[];
}

export interface LiteratureToolPayload {
  kind: "literature-search";
  summary: string;
  query: string;
  source: LiteratureSource;
  papers: AiPaper[];
}
