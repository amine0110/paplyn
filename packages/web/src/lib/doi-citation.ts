import { buildIntegrationHeaders } from "@/lib/integration-http";

export const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)\b/i;

export type DoiCitationSource = "crossref" | "openalex";

export interface DoiCitationResult {
  doi: string;
  title: string;
  citationKey: string;
  bibtex: string;
  source: DoiCitationSource;
}

export class DoiCitationError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "DoiCitationError";
  }
}

export function normalizeDoi(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/doi\.org\/(10\.\S+)/i);
  if (urlMatch?.[1]) {
    return cleanDoi(urlMatch[1]);
  }

  const bare = trimmed.match(DOI_REGEX);
  if (bare?.[1]) return cleanDoi(bare[1]);

  if (/^10\./i.test(trimmed)) return cleanDoi(trimmed);
  return null;
}

export function extractDoi(text: string): string | null {
  const match = text.match(DOI_REGEX);
  return match?.[1] ? cleanDoi(match[1]) : null;
}

function cleanDoi(doi: string): string {
  return doi.replace(/[.,;)\]}>]+$/g, "").trim();
}

function encodeDoiForUrl(doi: string): string {
  return encodeURIComponent(doi);
}

export function parseBibtexKey(bibtex: string): string | null {
  const match = bibtex.match(/@\w+\s*\{\s*([^,\s]+)/);
  return match?.[1]?.trim() ?? null;
}

export function parseBibtexTitle(bibtex: string): string | null {
  const match = bibtex.match(/title\s*=\s*\{([^}]*)\}/i);
  if (!match?.[1]) return null;
  return match[1].replace(/\\[{}\\]/g, (escaped) => escaped.slice(1)).trim() || null;
}

function bibtexEscape(value: string): string {
  return value.replace(/[{}\\]/g, "\\$&");
}

interface OpenAlexAuthor {
  author?: { display_name?: string };
}

interface OpenAlexWork {
  title?: string;
  publication_year?: number;
  authorships?: OpenAlexAuthor[];
  primary_location?: { source?: { display_name?: string } };
  doi?: string;
  type?: string;
}

async function fetchOpenAlexWork(doi: string): Promise<OpenAlexWork> {
  const url = `https://api.openalex.org/works/https://doi.org/${encodeDoiForUrl(doi)}`;
  const res = await fetch(url, {
    headers: buildIntegrationHeaders(),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new DoiCitationError("DOI not found", 404);
  }
  if (!res.ok) {
    throw new DoiCitationError(`OpenAlex lookup failed (${res.status})`, res.status);
  }
  return (await res.json()) as OpenAlexWork;
}

function formatOpenAlexBibtex(work: OpenAlexWork, doi: string): string {
  const authors = (work.authorships ?? [])
    .map((entry) => entry.author?.display_name?.trim())
    .filter(Boolean) as string[];
  const title = work.title?.trim() || "Untitled";
  const year = work.publication_year ?? "n.d.";
  const venue = work.primary_location?.source?.display_name?.trim();
  const authorPart = slugifyForCiteKey(firstAuthorSurname(authors[0] ?? "unknown"));
  const yearPart = typeof year === "number" ? String(year) : "nd";
  const titleWords = title
    .split(/\s+/)
    .map((word) => slugifyForCiteKey(word))
    .filter(Boolean)
    .slice(0, 3)
    .join("");
  const key = `${authorPart}${yearPart}${titleWords}`.slice(0, 48) || "ref";

  const entryType = work.type === "book" ? "book" : "article";
  const fields = [`  title = {${bibtexEscape(title)}}`];
  if (authors.length > 0) {
    fields.push(`  author = {${authors.map(bibtexEscape).join(" and ")}}`);
  }
  fields.push(`  year = {${year}}`);
  if (venue) fields.push(`  journal = {${bibtexEscape(venue)}}`);
  fields.push(`  doi = {${doi}}`);
  fields.push(`  url = {https://doi.org/${doi}}`);

  return `@${entryType}{${key},\n${fields.join(",\n")}\n}`;
}

function slugifyForCiteKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

function firstAuthorSurname(author: string): string {
  const parts = author
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length === 0) return "unknown";
  return parts[parts.length - 1] ?? "unknown";
}

export async function fetchBibtexFromCrossref(doi: string): Promise<string> {
  const url = `https://api.crossref.org/works/${encodeDoiForUrl(doi)}/transform/application/x-bibtex`;
  const res = await fetch(url, {
    headers: buildIntegrationHeaders({ Accept: "application/x-bibtex" }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new DoiCitationError("DOI not found", 404);
  }
  if (!res.ok) {
    throw new DoiCitationError(`Crossref lookup failed (${res.status})`, res.status);
  }
  const bibtex = (await res.text()).trim();
  if (!bibtex || !bibtex.includes("@")) {
    throw new DoiCitationError("Crossref returned invalid BibTeX");
  }
  return bibtex.endsWith("\n") ? bibtex : `${bibtex}\n`;
}

export async function fetchBibtexFromOpenAlex(doi: string): Promise<string> {
  const work = await fetchOpenAlexWork(doi);
  return formatOpenAlexBibtex(work, doi);
}

export async function resolveDoiCitation(doiInput: string): Promise<DoiCitationResult> {
  const doi = normalizeDoi(doiInput);
  if (!doi) {
    throw new DoiCitationError("Invalid DOI format", 400);
  }

  let bibtex: string;
  let source: DoiCitationSource;

  try {
    bibtex = await fetchBibtexFromCrossref(doi);
    source = "crossref";
  } catch (crossrefError) {
    if (crossrefError instanceof DoiCitationError && crossrefError.status === 404) {
      bibtex = await fetchBibtexFromOpenAlex(doi);
      source = "openalex";
    } else {
      try {
        bibtex = await fetchBibtexFromOpenAlex(doi);
        source = "openalex";
      } catch {
        if (crossrefError instanceof DoiCitationError) throw crossrefError;
        throw new DoiCitationError("Failed to resolve DOI");
      }
    }
  }

  const citationKey = parseBibtexKey(bibtex);
  if (!citationKey) {
    throw new DoiCitationError("Could not parse BibTeX citation key");
  }

  const title = parseBibtexTitle(bibtex) ?? doi;
  return { doi, title, citationKey, bibtex, source };
}
