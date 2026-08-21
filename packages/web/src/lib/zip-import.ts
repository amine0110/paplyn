import JSZip from "jszip";
import { detectMainTexFile, listTexFiles } from "./project-ops";
import {
  contentToDataUrl,
  isBinaryAsset,
  mimeTypeForPath,
  normalizePath,
  type ProjectFileEntry,
} from "./project-files";

const SKIP_PREFIXES = ["__MACOSX/", ".git/"];
const SKIP_EXACT = new Set([".DS_Store", "Thumbs.db"]);

export function shouldSkipZipEntry(path: string): boolean {
  if (SKIP_EXACT.has(path)) return true;
  for (const prefix of SKIP_PREFIXES) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/** Normalize and validate a zip entry path; returns null for directories, zip-slip, or junk paths. */
export function sanitizeZipEntryPath(rawPath: string): string | null {
  if (!rawPath || rawPath.endsWith("/")) return null;

  const normalized = normalizePath(rawPath);
  if (!normalized) return null;

  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    return null;
  }
  if (normalized.split("/").some((segment) => segment === "..")) {
    return null;
  }

  if (rawPath.startsWith("/") || rawPath.startsWith("\\")) return null;
  if (/^[a-zA-Z]:[\\/]/.test(rawPath)) return null;

  if (shouldSkipZipEntry(normalized)) return null;

  return normalized;
}

export function listSanitizedZipPaths(entryPaths: string[]): string[] {
  const paths: string[] = [];
  for (const rawPath of entryPaths) {
    const path = sanitizeZipEntryPath(rawPath);
    if (path) paths.push(path);
  }
  return paths;
}

/** When every entry lives under one top-level folder, strip that prefix (Overleaf-style exports). */
export function stripCommonRootPrefix(paths: string[]): Map<string, string> {
  if (paths.length === 0) return new Map();

  const segments = paths.map((path) => path.split("/"));
  const root = segments[0]?.[0];
  if (!root) return new Map(paths.map((path) => [path, path]));

  const allShareRoot = segments.every((parts) => parts[0] === root && parts.length > 1);
  if (!allShareRoot) return new Map(paths.map((path) => [path, path]));

  const map = new Map<string, string>();
  for (const path of paths) {
    const stripped = path.slice(root.length + 1);
    if (stripped) map.set(path, stripped);
  }
  return map;
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

export function encodeZipEntry(path: string, data: string | Uint8Array): ProjectFileEntry {
  const isBinary = isBinaryAsset(path);
  if (isBinary) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const base64 = uint8ArrayToBase64(bytes);
    return {
      path,
      content: contentToDataUrl(base64, mimeTypeForPath(path)),
      isBinary: true,
    };
  }

  const content = typeof data === "string" ? data : new TextDecoder().decode(data);
  return { path, content, isBinary: false };
}

export interface ParsedProjectZip {
  files: ProjectFileEntry[];
  mainFile: string;
}

export async function parseProjectZip(data: ArrayBuffer | Uint8Array): Promise<ParsedProjectZip> {
  const zip = await JSZip.loadAsync(data);
  const validEntries: { path: string; file: JSZip.JSZipObject }[] = [];

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const path = sanitizeZipEntryPath(relativePath);
    if (path) validEntries.push({ path, file });
  });

  if (validEntries.length === 0) {
    throw new Error("Zip archive contains no usable files");
  }

  const pathRemap = stripCommonRootPrefix(validEntries.map((entry) => entry.path));
  const files: ProjectFileEntry[] = [];

  for (const { path, file } of validEntries) {
    const finalPath = pathRemap.get(path) ?? path;
    if (!finalPath) continue;

    const isBinary = isBinaryAsset(finalPath);
    const raw = isBinary ? await file.async("uint8array") : await file.async("string");
    files.push(encodeZipEntry(finalPath, raw));
  }

  if (files.length === 0) {
    throw new Error("Zip archive contains no usable files");
  }

  const texFiles = listTexFiles(files.map((file) => file.path));
  const mainFile = detectMainTexFile(texFiles);
  if (!mainFile) {
    throw new Error("Zip archive must contain at least one .tex file");
  }

  return { files, mainFile };
}
