import { buildIntegrationHeaders } from "@/lib/integration-http";

const ZOTERO_API_BASE = "https://api.zotero.org";

export interface ZoteroCredentials {
  userId: string;
  apiKey: string;
}

export interface ZoteroItem {
  itemKey: string;
  title: string;
  year: number | null;
  authors: string[];
  itemType: string;
}

export interface ZoteroSearchResult {
  query: string;
  items: ZoteroItem[];
}

export class ZoteroError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ZoteroError";
    this.status = status;
  }
}

interface ZoteroCreator {
  creatorType?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}

interface ZoteroItemData {
  key?: string;
  itemType?: string;
  title?: string;
  date?: string;
  creators?: ZoteroCreator[];
}

interface ZoteroApiItem {
  key: string;
  data?: ZoteroItemData;
}

function formatCreator(creator: ZoteroCreator): string {
  if (creator.name?.trim()) return creator.name.trim();
  const parts = [creator.firstName?.trim(), creator.lastName?.trim()].filter(Boolean);
  return parts.join(" ");
}

function parseYear(date?: string): number | null {
  if (!date) return null;
  const match = date.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

const SKIPPED_ITEM_TYPES = new Set(["attachment", "note", "annotation", "link"]);

export function mapZoteroApiItem(item: ZoteroApiItem): ZoteroItem | null {
  const data = item.data;
  if (!data) return null;

  const itemType = data.itemType ?? "item";
  if (SKIPPED_ITEM_TYPES.has(itemType)) return null;

  const title = data.title?.trim();
  if (!title) return null;

  const authors = (data.creators ?? [])
    .filter((creator) => creator.creatorType === "author" || !creator.creatorType)
    .map(formatCreator)
    .filter(Boolean);

  return {
    itemKey: item.key,
    title,
    year: parseYear(data.date),
    authors,
    itemType,
  };
}

export function parseZoteroSearchResponse(query: string, payload: unknown): ZoteroSearchResult {
  const rawItems = Array.isArray(payload) ? payload : [];
  const items: ZoteroItem[] = [];

  for (const entry of rawItems) {
    if (!entry || typeof entry !== "object") continue;
    const mapped = mapZoteroApiItem(entry as ZoteroApiItem);
    if (mapped) items.push(mapped);
  }

  return { query, items };
}

function zoteroAuthHeaders(apiKey: string): HeadersInit {
  return buildIntegrationHeaders({
    "Zotero-API-Key": apiKey,
  });
}

export async function searchZoteroLibrary(
  credentials: ZoteroCredentials,
  query: string,
  limit = 8
): Promise<ZoteroSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new ZoteroError("Search query is required", 400);
  }

  const url = new URL(`${ZOTERO_API_BASE}/users/${encodeURIComponent(credentials.userId)}/items`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("qmode", "titleCreatorYear");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));

  const res = await fetch(url, {
    headers: zoteroAuthHeaders(credentials.apiKey),
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ZoteroError("Invalid Zotero API key. Check Settings → Zotero.", res.status);
  }

  if (!res.ok) {
    throw new ZoteroError(`Zotero search failed (${res.status})`, res.status);
  }

  const payload = (await res.json()) as unknown;
  return parseZoteroSearchResponse(trimmed, payload);
}

export async function fetchZoteroItemBibtex(
  credentials: ZoteroCredentials,
  itemKey: string
): Promise<string> {
  const trimmedKey = itemKey.trim();
  if (!trimmedKey) {
    throw new ZoteroError("Zotero item key is required", 400);
  }

  const url = `${ZOTERO_API_BASE}/users/${encodeURIComponent(credentials.userId)}/items/${encodeURIComponent(trimmedKey)}?format=bibtex`;

  const res = await fetch(url, {
    headers: zoteroAuthHeaders(credentials.apiKey),
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new ZoteroError("Invalid Zotero API key. Check Settings → Zotero.", res.status);
  }

  if (res.status === 404) {
    throw new ZoteroError("Zotero item not found", 404);
  }

  if (!res.ok) {
    throw new ZoteroError(`Zotero BibTeX export failed (${res.status})`, res.status);
  }

  const bibtex = await res.text();
  if (!bibtex.trim()) {
    throw new ZoteroError("Zotero returned empty BibTeX", 502);
  }

  return bibtex.trim();
}

export function formatZoteroSearchForModel(result: ZoteroSearchResult): string {
  if (result.items.length === 0) {
    return `No Zotero library items found for "${result.query}".`;
  }

  const lines = [`Found ${result.items.length} item(s) in your Zotero library for "${result.query}":`];
  for (const item of result.items) {
    const authorText =
      item.authors.length > 0 ? item.authors.slice(0, 3).join(", ") : "Unknown authors";
    const yearText = item.year != null ? String(item.year) : "n.d.";
    lines.push(
      `- ${item.title}`,
      `  Authors: ${authorText}`,
      `  Year: ${yearText}`,
      `  Type: ${item.itemType}`,
      `  Item key: ${item.itemKey}`
    );
  }
  return lines.join("\n");
}
