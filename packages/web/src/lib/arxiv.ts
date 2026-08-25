import JSZip from "jszip";
import { buildIntegrationHeaders } from "@/lib/integration-http";
import { encodeZipEntry, sanitizeZipEntryPath } from "@/lib/zip-import";
import type { ProjectFileEntry } from "@/lib/project-files";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const ARXIV_ID_REGEX = /(?:arxiv\.org\/(?:abs|pdf|e-print)\/)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?)/i;

export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  pdfUrl: string;
  sourceUrl: string;
  publishedAt: string | null;
}

export interface ArxivSearchResult {
  query: string;
  papers: ArxivPaper[];
}

export class ArxivError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ArxivError";
  }
}

export function normalizeArxivId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPrefix = trimmed.replace(/^arxiv:\s*/i, "");
  const match = withoutPrefix.match(ARXIV_ID_REGEX);
  if (match?.[1]) return match[1].replace(/\.pdf$/i, "");

  if (/^\d{4}\.\d{4,5}(?:v\d+)?$/i.test(withoutPrefix)) return withoutPrefix;
  if (/^[a-z-]+(?:\.[A-Z]{2})?\/\d{7}(?:v\d+)?$/i.test(withoutPrefix)) return withoutPrefix;
  return null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(re);
  if (!match?.[1]) return null;
  return decodeXmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractArxivIdFromEntry(block: string): string | null {
  const absLink = block.match(/<link[^>]+href="https?:\/\/arxiv\.org\/abs\/([^"]+)"/i);
  if (absLink?.[1]) return absLink[1];
  const idTag = extractTag(block, "id");
  if (!idTag) return null;
  const tail = idTag.split("/").pop();
  return tail ?? null;
}

export function parseArxivAtomFeed(xml: string): ArxivPaper[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) ?? [];
  const papers: ArxivPaper[] = [];

  for (const block of entries) {
    const id = extractArxivIdFromEntry(block);
    const title = extractTag(block, "title");
    if (!id || !title) continue;

    const authors = [...block.matchAll(/<author>\s*<name>([^<]+)<\/name>/gi)].map((match) =>
      decodeXmlEntities(match[1]?.trim() ?? "")
    );
    const summary = extractTag(block, "summary");
    const published = extractTag(block, "published");
    const year = published ? Number.parseInt(published.slice(0, 4), 10) : null;

    papers.push({
      id,
      title,
      authors,
      year: Number.isFinite(year) ? year : null,
      abstract: summary,
      pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
      sourceUrl: `https://arxiv.org/abs/${id}`,
      publishedAt: published,
    });
  }

  return papers;
}

export async function searchArxiv(query: string, maxResults = 8): Promise<ArxivSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new ArxivError("Search query is required", 400);
  }

  const arxivId = normalizeArxivId(trimmed);
  const searchQuery = arxivId
    ? `id_list=${encodeURIComponent(arxivId)}`
    : `search_query=${encodeURIComponent(`all:${trimmed}`)}`;

  const url = `${ARXIV_API_URL}?${searchQuery}&start=0&max_results=${maxResults}`;
  const res = await fetch(url, {
    headers: buildIntegrationHeaders({ Accept: "application/atom+xml" }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ArxivError(`arXiv search failed (${res.status})`, res.status);
  }

  const xml = await res.text();
  const papers = parseArxivAtomFeed(xml);
  return { query: trimmed, papers };
}

async function fetchBinary(url: string): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: buildIntegrationHeaders(),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ArxivError(`Failed to download from arXiv (${res.status})`, res.status);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchArxivPdf(arxivId: string): Promise<ProjectFileEntry> {
  const id = normalizeArxivId(arxivId);
  if (!id) throw new ArxivError("Invalid arXiv ID", 400);
  const bytes = await fetchBinary(`https://arxiv.org/pdf/${id}.pdf`);
  return encodeZipEntry(`arxiv/${id}.pdf`, bytes);
}

async function extractArxivSourceArchive(bytes: Uint8Array, arxivId: string): Promise<ProjectFileEntry[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new ArxivError("arXiv source archive is not a readable zip");
  }

  const pending: { path: string; file: JSZip.JSZipObject }[] = [];
  const prefix = `arxiv/${arxivId}/`;

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const path = sanitizeZipEntryPath(relativePath);
    if (!path) return;
    pending.push({ path: `${prefix}${path}`, file });
  });

  const resolved: ProjectFileEntry[] = [];
  for (const entry of pending) {
    const isBinary = /\.(png|jpg|jpeg|pdf)$/i.test(entry.path);
    const raw = isBinary ? await entry.file.async("uint8array") : await entry.file.async("string");
    resolved.push(encodeZipEntry(entry.path, raw));
  }

  if (resolved.length === 0) {
    throw new ArxivError("arXiv source archive contained no usable files");
  }

  return resolved;
}

export async function fetchArxivSource(arxivId: string): Promise<ProjectFileEntry[]> {
  const id = normalizeArxivId(arxivId);
  if (!id) throw new ArxivError("Invalid arXiv ID", 400);
  const bytes = await fetchBinary(`https://arxiv.org/e-print/${id}`);
  return extractArxivSourceArchive(bytes, id);
}

export function formatArxivSearchForModel(result: ArxivSearchResult): string {
  if (result.papers.length === 0) {
    return `No arXiv papers found for "${result.query}".`;
  }

  const lines = [`Found ${result.papers.length} arXiv paper(s) for "${result.query}":`];
  for (const paper of result.papers) {
    const authors =
      paper.authors.length <= 3
        ? paper.authors.join(", ")
        : `${paper.authors.slice(0, 3).join(", ")} et al.`;
    lines.push(
      `- ${paper.title} (${paper.year ?? "n.d."})`,
      `  Authors: ${authors || "Unknown"}`,
      `  arXiv: ${paper.id}`,
      `  PDF: ${paper.pdfUrl}`
    );
  }
  return lines.join("\n");
}
