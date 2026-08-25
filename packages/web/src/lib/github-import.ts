import { buildIntegrationHeaders } from "@/lib/integration-http";
import { detectMainTexFile, listTexFiles } from "@/lib/project-ops";
import {
  contentToDataUrl,
  isBinaryAsset,
  mimeTypeForPath,
  normalizePath,
  type ProjectFileEntry,
} from "@/lib/project-files";

const GITHUB_API = "https://api.github.com";
const IMPORTABLE_EXTENSIONS = new Set([
  "tex",
  "bib",
  "cls",
  "sty",
  "png",
  "jpg",
  "jpeg",
  "pdf",
]);

export interface GitHubRepoRef {
  owner: string;
  repo: string;
}

export interface ParsedGitHubProject {
  files: ProjectFileEntry[];
  mainFile: string;
  repo: GitHubRepoRef;
  defaultBranch: string;
}

export class GitHubImportError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "GitHubImportError";
  }
}

export function parseGitHubRepoInput(input: string): GitHubRepoRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (urlMatch?.[1] && urlMatch?.[2]) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/i, "") };
  }

  const slugMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slugMatch?.[1] && slugMatch?.[2]) {
    return { owner: slugMatch[1], repo: slugMatch[2].replace(/\.git$/i, "") };
  }

  return null;
}

function isImportablePath(path: string): boolean {
  const normalized = normalizePath(path);
  if (!normalized || normalized.startsWith(".")) return false;
  const ext = normalized.split(".").pop()?.toLowerCase() ?? "";
  return IMPORTABLE_EXTENSIONS.has(ext);
}

interface GitHubRepoResponse {
  private?: boolean;
  default_branch?: string;
}

interface GitHubTreeResponse {
  tree?: { path?: string; type?: string }[];
}

async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: buildIntegrationHeaders({
      Accept: "application/vnd.github+json",
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new GitHubImportError("Repository not found or not public", 404);
  }
  if (!res.ok) {
    throw new GitHubImportError(`GitHub API error (${res.status})`, res.status);
  }

  return (await res.json()) as T;
}

async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<Uint8Array> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const res = await fetch(url, {
    headers: buildIntegrationHeaders(),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GitHubImportError(`Failed to download ${path} (${res.status})`, res.status);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function encodeProjectFile(path: string, bytes: Uint8Array): ProjectFileEntry {
  const isBinary = isBinaryAsset(path);
  if (isBinary) {
    const base64 = uint8ArrayToBase64(bytes);
    return {
      path,
      content: contentToDataUrl(base64, mimeTypeForPath(path)),
      isBinary: true,
    };
  }
  return {
    path,
    content: new TextDecoder().decode(bytes),
    isBinary: false,
  };
}

export async function importPublicGitHubRepo(input: string): Promise<ParsedGitHubProject> {
  const ref = parseGitHubRepoInput(input);
  if (!ref) {
    throw new GitHubImportError("Invalid GitHub repository URL or owner/repo", 400);
  }

  const repoMeta = await githubFetch<GitHubRepoResponse>(`/repos/${ref.owner}/${ref.repo}`);
  if (repoMeta.private) {
    throw new GitHubImportError("Private repositories are not supported", 403);
  }

  const branch = repoMeta.default_branch?.trim() || "main";
  const tree = await githubFetch<GitHubTreeResponse>(
    `/repos/${ref.owner}/${ref.repo}/git/trees/${branch}?recursive=1`
  );

  const paths = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path && isImportablePath(entry.path))
    .map((entry) => normalizePath(entry.path!));

  if (paths.length === 0) {
    throw new GitHubImportError("Repository contains no importable .tex, .bib, or figure files", 400);
  }

  const texFiles = listTexFiles(paths);
  const mainFile = detectMainTexFile(texFiles);
  if (!mainFile) {
    throw new GitHubImportError("Repository contains no .tex files", 400);
  }

  const files: ProjectFileEntry[] = [];
  for (const path of paths) {
    const bytes = await fetchRawFile(ref.owner, ref.repo, branch, path);
    files.push(encodeProjectFile(path, bytes));
  }

  return { files, mainFile, repo: ref, defaultBranch: branch };
}
