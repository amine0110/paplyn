/**
 * Academic literature search for the AI assistant.
 * Primary: Semantic Scholar Graph API (free, structured).
 * Fallback: OpenAlex (free) when S2 is unavailable.
 */

import { PRODUCT_NAME } from "@/lib/product";

export const LITERATURE_SEARCH_LIMIT = 8;
export const LITERATURE_RESULT_CHAR_LIMIT = 6_000;

const USER_AGENT = `${PRODUCT_NAME} academic assistant (https://plicum.com)`;

export interface LiteraturePaper {
  title: string;
  year: number | null;
  authors: string[];
  venue: string | null;
  citationCount: number | null;
  abstract: string | null;
  tldr: string | null;
  doi: string | null;
  url: string | null;
  source: "semantic-scholar" | "openalex";
}

export interface LiteratureSearchResult {
  query: string;
  papers: LiteraturePaper[];
  source: "semantic-scholar" | "openalex";
  error?: string;
}

interface S2Author {
  name?: string;
}

interface S2Paper {
  title?: string;
  year?: number;
  authors?: S2Author[];
  venue?: string;
  citationCount?: number;
  abstract?: string;
  tldr?: { text?: string };
  externalIds?: { DOI?: string };
  url?: string;
}

interface S2SearchResponse {
  data?: S2Paper[];
}

interface OpenAlexAuthor {
  display_name?: string;
}

interface OpenAlexWork {
  title?: string;
  publication_year?: number;
  authorships?: { author?: OpenAlexAuthor }[];
  primary_location?: { source?: { display_name?: string } };
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  doi?: string;
  id?: string;
}

interface OpenAlexSearchResponse {
  results?: OpenAlexWork[];
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  const apiKey = process.env.S2_API_KEY?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

function normalizeAuthors(names: string[]): string[] {
  return names.filter(Boolean).slice(0, 6);
}

function formatAuthorList(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function decodeOpenAlexAbstract(index?: Record<string, number[]>): string | null {
  if (!index) return null;
  const maxPos = Math.max(...Object.values(index).flat(), -1);
  if (maxPos < 0) return null;
  const words: string[] = new Array(maxPos + 1).fill("");
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.join(" ").trim() || null;
}

function mapS2Paper(paper: S2Paper): LiteraturePaper {
  const authors = normalizeAuthors((paper.authors ?? []).map((a) => a.name ?? "").filter(Boolean));
  return {
    title: paper.title?.trim() || "Untitled",
    year: paper.year ?? null,
    authors,
    venue: paper.venue?.trim() || null,
    citationCount: paper.citationCount ?? null,
    abstract: paper.abstract?.trim() || null,
    tldr: paper.tldr?.text?.trim() || null,
    doi: paper.externalIds?.DOI?.trim() || null,
    url: paper.url?.trim() || null,
    source: "semantic-scholar",
  };
}

function mapOpenAlexWork(work: OpenAlexWork): LiteraturePaper {
  const authors = normalizeAuthors(
    (work.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean)
  );
  const doi = work.doi?.replace(/^https?:\/\/doi\.org\//i, "").trim() || null;
  return {
    title: work.title?.trim() || "Untitled",
    year: work.publication_year ?? null,
    authors,
    venue: work.primary_location?.source?.display_name?.trim() || null,
    citationCount: work.cited_by_count ?? null,
    abstract: decodeOpenAlexAbstract(work.abstract_inverted_index),
    tldr: null,
    doi,
    url: work.id?.trim() || (doi ? `https://doi.org/${doi}` : null),
    source: "openalex",
  };
}

async function searchSemanticScholar(query: string): Promise<LiteraturePaper[]> {
  const fields = [
    "title",
    "year",
    "authors",
    "venue",
    "citationCount",
    "abstract",
    "tldr",
    "externalIds",
    "url",
  ].join(",");

  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(LITERATURE_SEARCH_LIMIT));
  url.searchParams.set("fields", fields);

  const res = await fetch(url, { headers: buildHeaders(), signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    throw new Error(`Semantic Scholar search failed (${res.status})`);
  }

  const data = (await res.json()) as S2SearchResponse;
  return (data.data ?? []).map(mapS2Paper);
}

async function searchOpenAlex(query: string): Promise<LiteraturePaper[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", String(LITERATURE_SEARCH_LIMIT));
  url.searchParams.set(
    "select",
    "title,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index,doi,id"
  );
  url.searchParams.set("mailto", "ai@plicum.com");

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) {
    throw new Error(`OpenAlex search failed (${res.status})`);
  }

  const data = (await res.json()) as OpenAlexSearchResponse;
  return (data.results ?? []).map(mapOpenAlexWork);
}

export async function searchLiterature(query: string): Promise<LiteratureSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, papers: [], source: "semantic-scholar", error: "Empty search query." };
  }

  try {
    const papers = await searchSemanticScholar(trimmed);
    return { query: trimmed, papers, source: "semantic-scholar" };
  } catch (s2Error) {
    console.warn("Semantic Scholar search failed, trying OpenAlex:", s2Error);
    try {
      const papers = await searchOpenAlex(trimmed);
      return { query: trimmed, papers, source: "openalex" };
    } catch (openAlexError) {
      console.error("OpenAlex search also failed:", openAlexError);
      const message =
        s2Error instanceof Error ? s2Error.message : "Literature search is temporarily unavailable.";
      return {
        query: trimmed,
        papers: [],
        source: "semantic-scholar",
        error: `${message} Do not invent papers; tell the user search failed.`,
      };
    }
  }
}

function oneLineWhy(paper: LiteraturePaper): string {
  const snippet = paper.tldr || paper.abstract;
  if (!snippet) return "No summary available.";
  const flat = snippet.replace(/\s+/g, " ").trim();
  if (flat.length <= 180) return flat;
  return `${flat.slice(0, 177)}...`;
}

/** Compact text for the model tool result (bounded size). */
export function formatLiteratureSearchForModel(result: LiteratureSearchResult): string {
  if (result.error) {
    return `Literature search failed for "${result.query}". ${result.error} Do not invent papers; tell the user search failed.`;
  }

  if (result.papers.length === 0) {
    return `No papers found for "${result.query}". Do not invent citations.`;
  }

  const lines = [
    `Found ${result.papers.length} paper(s) for "${result.query}" via ${result.source}.`,
    "Cite only these real results. Format for the user as markdown bullets with title, year, authors, venue, citations, one-line relevance, and DOI/url.",
    "",
  ];

  for (const [i, paper] of result.papers.entries()) {
    const link = paper.doi ? `https://doi.org/${paper.doi}` : paper.url;
    lines.push(
      `${i + 1}. **${paper.title}** (${paper.year ?? "n.d."})`,
      `   Authors: ${formatAuthorList(paper.authors)}`,
      `   Venue: ${paper.venue ?? "Unknown"} | Citations: ${paper.citationCount ?? "—"}`,
      `   Why relevant: ${oneLineWhy(paper)}`,
      link ? `   Link: ${link}` : "   Link: unavailable",
      paper.doi ? `   DOI: ${paper.doi}` : "",
      ""
    );
  }

  let text = lines.join("\n").trim();
  if (text.length > LITERATURE_RESULT_CHAR_LIMIT) {
    text = `${text.slice(0, LITERATURE_RESULT_CHAR_LIMIT)}\n\n[... truncated for context limit ...]`;
  }
  return text;
}
