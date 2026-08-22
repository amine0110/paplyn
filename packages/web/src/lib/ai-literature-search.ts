/**
 * Academic literature search for the AI assistant.
 *
 * Live API only: queries Semantic Scholar Graph `/paper/search` at request time.
 * No S2AG monthly dataset dumps, local indexes, or result caching.
 * OpenAlex is a live fallback when S2 is unavailable.
 */

import { PRODUCT_NAME } from "@/lib/product";

export const LITERATURE_SEARCH_LIMIT = 8;
/** Fetch extra hits from live search, then re-rank for recency before trimming. */
export const LITERATURE_SEARCH_FETCH_LIMIT = 24;
export const LITERATURE_RESULT_CHAR_LIMIT = 6_000;
/** Years back counted as "recent" for warnings when none appear in results. */
export const RECENT_YEAR_WINDOW = 5;
/** Prefer surfacing papers from this many years back (still includes older hits). */
export const PREFER_RECENT_YEARS = 8;

const USER_AGENT = `${PRODUCT_NAME} academic assistant (https://plicum.com)`;
const S2_LIVE_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/paper/search";

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
  /** Set when the live index returned no papers within RECENT_YEAR_WINDOW. */
  recencyNote?: string;
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

export function currentLiteratureYear(): number {
  return new Date().getFullYear();
}

function normalizeAuthors(names: string[]): string[] {
  return names.filter(Boolean).slice(0, 6);
}

function formatAuthorList(authors: string[]): string {
  if (authors.length === 0) return "Unknown authors";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} et al.`;
}

function paperKey(paper: LiteraturePaper): string {
  if (paper.doi) return `doi:${paper.doi.toLowerCase()}`;
  return `title:${paper.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export function dedupeLiteraturePapers(papers: LiteraturePaper[]): LiteraturePaper[] {
  const seen = new Set<string>();
  const unique: LiteraturePaper[] = [];
  for (const paper of papers) {
    const key = paperKey(paper);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(paper);
  }
  return unique;
}

function compareByYearThenCitations(a: LiteraturePaper, b: LiteraturePaper): number {
  const yearDiff = (b.year ?? 0) - (a.year ?? 0);
  if (yearDiff !== 0) return yearDiff;
  return (b.citationCount ?? 0) - (a.citationCount ?? 0);
}

/**
 * Re-rank live search hits so literature reviews surface recent work, not only highly cited classics.
 * Recent papers (within PREFER_RECENT_YEARS) are listed first, then older papers by year.
 */
export function rankPapersForLiteratureReview(
  papers: LiteraturePaper[],
  options?: { preferRecentYears?: number; limit?: number; nowYear?: number }
): LiteraturePaper[] {
  const preferRecentYears = options?.preferRecentYears ?? PREFER_RECENT_YEARS;
  const limit = options?.limit ?? LITERATURE_SEARCH_LIMIT;
  const nowYear = options?.nowYear ?? currentLiteratureYear();
  const recentThreshold = nowYear - preferRecentYears;

  const recent = papers.filter((paper) => paper.year != null && paper.year >= recentThreshold);
  const older = papers.filter((paper) => paper.year == null || paper.year < recentThreshold);

  recent.sort(compareByYearThenCitations);
  older.sort(compareByYearThenCitations);

  return dedupeLiteraturePapers([...recent, ...older]).slice(0, limit);
}

export function buildRecencyNote(
  papers: LiteraturePaper[],
  options?: { recentYearWindow?: number; nowYear?: number }
): string | undefined {
  const recentYearWindow = options?.recentYearWindow ?? RECENT_YEAR_WINDOW;
  const nowYear = options?.nowYear ?? currentLiteratureYear();
  const recentCutoff = nowYear - recentYearWindow;

  const hasRecent = papers.some((paper) => paper.year != null && paper.year >= recentCutoff);
  if (hasRecent || papers.length === 0) return undefined;

  return `No papers from ${recentCutoff}–${nowYear} appeared in these live search results. Older seminal work may dominate relevance ranking — mention that to the user and do not invent newer citations. Brand-new preprints can lag ingestion by a few days.`;
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

async function fetchLiveSemanticScholarSearch(
  query: string,
  options?: { limit?: number; year?: string }
): Promise<LiteraturePaper[]> {
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

  const url = new URL(S2_LIVE_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(options?.limit ?? LITERATURE_SEARCH_FETCH_LIMIT));
  url.searchParams.set("fields", fields);
  if (options?.year) url.searchParams.set("year", options.year);

  const res = await fetch(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Semantic Scholar search failed (${res.status})`);
  }

  const data = (await res.json()) as S2SearchResponse;
  return (data.data ?? []).map(mapS2Paper);
}

async function searchSemanticScholar(query: string): Promise<LiteraturePaper[]> {
  const nowYear = currentLiteratureYear();
  const preferFromYear = nowYear - PREFER_RECENT_YEARS;

  const primary = await fetchLiveSemanticScholarSearch(query);
  let merged = rankPapersForLiteratureReview(primary, { nowYear });

  const recentCutoff = nowYear - RECENT_YEAR_WINDOW;
  const hasRecent = merged.some((paper) => paper.year != null && paper.year >= recentCutoff);

  if (!hasRecent) {
    const recentOnly = await fetchLiveSemanticScholarSearch(query, {
      year: `${preferFromYear}-`,
      limit: LITERATURE_SEARCH_FETCH_LIMIT,
    });
    merged = rankPapersForLiteratureReview(dedupeLiteraturePapers([...recentOnly, ...primary]), {
      nowYear,
    });
  }

  return merged;
}

async function searchOpenAlex(query: string): Promise<LiteraturePaper[]> {
  const nowYear = currentLiteratureYear();
  const preferFromYear = nowYear - PREFER_RECENT_YEARS;

  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", String(LITERATURE_SEARCH_FETCH_LIMIT));
  url.searchParams.set("sort", "publication_date:desc");
  url.searchParams.set(
    "select",
    "title,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index,doi,id"
  );
  url.searchParams.set("mailto", "ai@plicum.com");

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`OpenAlex search failed (${res.status})`);
  }

  const data = (await res.json()) as OpenAlexSearchResponse;
  let papers = rankPapersForLiteratureReview((data.results ?? []).map(mapOpenAlexWork), { nowYear });

  const recentCutoff = nowYear - RECENT_YEAR_WINDOW;
  const hasRecent = papers.some((paper) => paper.year != null && paper.year >= recentCutoff);

  if (!hasRecent) {
    const recentUrl = new URL("https://api.openalex.org/works");
    recentUrl.searchParams.set("search", query);
    recentUrl.searchParams.set("per_page", String(LITERATURE_SEARCH_FETCH_LIMIT));
    recentUrl.searchParams.set("sort", "publication_date:desc");
    recentUrl.searchParams.set("filter", `from_publication_date:${preferFromYear}-01-01`);
    recentUrl.searchParams.set(
      "select",
      "title,publication_year,authorships,primary_location,cited_by_count,abstract_inverted_index,doi,id"
    );
    recentUrl.searchParams.set("mailto", "ai@plicum.com");

    const recentRes = await fetch(recentUrl, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (recentRes.ok) {
      const recentData = (await recentRes.json()) as OpenAlexSearchResponse;
      papers = rankPapersForLiteratureReview(
        dedupeLiteraturePapers([...(recentData.results ?? []).map(mapOpenAlexWork), ...(data.results ?? []).map(mapOpenAlexWork)]),
        { nowYear }
      );
    }
  }

  return papers;
}

export async function searchLiterature(query: string): Promise<LiteratureSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, papers: [], source: "semantic-scholar", error: "Empty search query." };
  }

  try {
    const papers = await searchSemanticScholar(trimmed);
    return {
      query: trimmed,
      papers,
      source: "semantic-scholar",
      recencyNote: buildRecencyNote(papers),
    };
  } catch (s2Error) {
    console.warn("Semantic Scholar search failed, trying OpenAlex:", s2Error);
    try {
      const papers = await searchOpenAlex(trimmed);
      return {
        query: trimmed,
        papers,
        source: "openalex",
        recencyNote: buildRecencyNote(papers),
      };
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
    `Found ${result.papers.length} paper(s) for "${result.query}" via live ${result.source} search (queried at request time).`,
    "Cite only these real results. Format for the user as markdown bullets with title, year, authors, venue, citations, one-line relevance, and DOI/url.",
    "Prioritize discussing newer papers when present; include publication year for every entry.",
  ];

  if (result.recencyNote) {
    lines.push(result.recencyNote);
  }

  lines.push("");

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
