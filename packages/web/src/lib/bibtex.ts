import type { AiPaper } from "@/lib/ai-types";

const BIB_ENTRY_KEY_RE = /@\w+\s*\{\s*([^,\s]+)/g;
const BIB_REF_RE = /\\(?:bibliography|addbibresource)\{([^}]+)\}/g;

export function parseBibKeys(bibContent: string): Set<string> {
  const keys = new Set<string>();
  for (const match of bibContent.matchAll(BIB_ENTRY_KEY_RE)) {
    const key = match[1]?.trim();
    if (key) keys.add(key);
  }
  return keys;
}

function normalizeBibRefName(ref: string): string {
  const trimmed = ref.trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith(".bib") ? trimmed : `${trimmed}.bib`;
}

function getFileContent(
  path: string,
  fileContents: Record<string, string>
): string | undefined {
  return fileContents[path];
}

export function resolveProjectBibPath(options: {
  mainFile: string;
  filePaths: string[];
  fileContents: Record<string, string>;
}): string {
  const bibFiles = options.filePaths.filter((path) => path.endsWith(".bib"));
  const texPaths = [
    options.mainFile,
    ...options.filePaths.filter((path) => path.endsWith(".tex")),
  ];

  for (const texPath of texPaths) {
    const content = getFileContent(texPath, options.fileContents);
    if (!content) continue;

    for (const match of content.matchAll(BIB_REF_RE)) {
      const bibPath = normalizeBibRefName(match[1] ?? "");
      if (!bibPath) continue;
      if (bibFiles.includes(bibPath)) return bibPath;
      return bibPath;
    }
  }

  const defaults = ["references.bib", "refs.bib", "bibliography.bib"];
  for (const candidate of defaults) {
    if (bibFiles.includes(candidate)) return candidate;
  }

  if (bibFiles.length > 0) return bibFiles[0]!;
  return "references.bib";
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

export function suggestCitationKey(paper: AiPaper, existingKeys: Set<string>): string {
  const authorPart = slugifyForCiteKey(firstAuthorSurname(paper.authors[0] ?? "unknown"));
  const yearPart = paper.year != null ? String(paper.year) : "nd";
  const titleWords = paper.title
    .split(/\s+/)
    .map((word) => slugifyForCiteKey(word))
    .filter(Boolean)
    .slice(0, 3)
    .join("");
  const base = `${authorPart}${yearPart}${titleWords}`.slice(0, 48) || "ref";

  let key = base;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `${base}${suffix}`;
    suffix += 1;
  }
  return key;
}

function bibtexEscape(value: string): string {
  return value.replace(/[{}\\]/g, "\\$&");
}

export function formatBibtexEntry(paper: AiPaper, key: string): string {
  const fields: string[] = [`  title = {${bibtexEscape(paper.title)}}`];

  if (paper.authors.length > 0) {
    fields.push(`  author = {${paper.authors.map(bibtexEscape).join(" and ")}}`);
  }
  if (paper.year != null) {
    fields.push(`  year = {${paper.year}}`);
  }
  if (paper.venue) {
    fields.push(`  journal = {${bibtexEscape(paper.venue)}}`);
  }
  if (paper.doi) {
    fields.push(`  doi = {${paper.doi}}`);
  }
  if (paper.url) {
    fields.push(`  url = {${bibtexEscape(paper.url)}}`);
  }

  return `@article{${key},\n${fields.join(",\n")}\n}`;
}

export function appendBibEntry(bibContent: string, entry: string, key: string): string {
  const keys = parseBibKeys(bibContent);
  if (keys.has(key)) return bibContent;

  const trimmed = bibContent.trimEnd();
  if (!trimmed) return `${entry}\n`;
  return `${trimmed}\n\n${entry}\n`;
}
