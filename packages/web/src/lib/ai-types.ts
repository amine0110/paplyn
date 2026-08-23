/** Client-safe types for AI assistant API responses. */

import type { AiClientAction } from "@/lib/ai-client-actions";

export type { AiClientAction };

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
