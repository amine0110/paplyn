export const FOLDER_PLACEHOLDER = ".keep";

const TEXT_EXTENSIONS = new Set(["tex", "bib", "cls", "sty"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

export interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: FileTreeNode[];
}

export function getFileExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

export function isTextSourceFile(path: string): boolean {
  return TEXT_EXTENSIONS.has(getFileExtension(path));
}

export function isImageFile(path: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(path));
}

export function isPdfFile(path: string): boolean {
  return getFileExtension(path) === "pdf";
}

export function isBinaryAsset(path: string): boolean {
  return isImageFile(path) || isPdfFile(path);
}

export function isFolderPlaceholder(path: string): boolean {
  return path.endsWith(`/${FOLDER_PLACEHOLDER}`) || path === FOLDER_PLACEHOLDER;
}

export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

export function joinPath(folder: string, name: string): string {
  const normalizedFolder = normalizePath(folder);
  const normalizedName = normalizePath(name);
  if (!normalizedFolder) return normalizedName;
  if (!normalizedName) return normalizedFolder;
  return `${normalizedFolder}/${normalizedName}`;
}

export function folderPathFromFile(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? "" : normalized.slice(0, slash);
}

export function folderPlaceholderPath(folderName: string): string {
  return joinPath(normalizePath(folderName), FOLDER_PLACEHOLDER);
}

export function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const rawPath of [...paths].sort()) {
    const path = normalizePath(rawPath);
    if (!path || isFolderPlaceholder(path)) continue;

    const parts = path.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === parts[i]);

      if (!node) {
        node = { name: parts[i], path: currentPath, isFile, children: [] };
        current.push(node);
      }

      if (!isFile) current = node.children;
    }
  }

  // Ensure empty folders (placeholder-only) appear in the tree.
  for (const rawPath of paths) {
    const path = normalizePath(rawPath);
    if (!isFolderPlaceholder(path)) continue;

    const folder = path.slice(0, -(FOLDER_PLACEHOLDER.length + 1));
    if (!folder) continue;

    const parts = folder.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const isFile = false;
      let node = current.find((n) => n.name === parts[i]);

      if (!node) {
        node = { name: parts[i], path: currentPath, isFile, children: [] };
        current.push(node);
      } else {
        node.isFile = false;
      }

      current = node.children;
    }
  }

  return sortTreeNodes(root);
}

function sortTreeNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortTreeNodes(node.children),
    }))
    .sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
}

export function contentToBase64(content: string): string | null {
  if (!content.startsWith("data:")) return content || null;
  const comma = content.indexOf(",");
  return comma >= 0 ? content.slice(comma + 1) : null;
}

export function contentToDataUrl(content: string, mimeType: string): string {
  if (content.startsWith("data:")) return content;
  return `data:${mimeType};base64,${content}`;
}

export function mimeTypeForPath(path: string): string {
  const ext = getFileExtension(path);
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function projectPdfFilename(projectName: string): string {
  const withoutExt = projectName.trim().replace(/\.pdf$/i, "");
  const sanitized = withoutExt
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = sanitized || "manuscript";
  return `${base}.pdf`;
}

export const PDF_DOWNLOAD_MIME = "application/pdf";

export function pdfDownloadHref(base64: string): string {
  return `data:${PDF_DOWNLOAD_MIME};base64,${base64}`;
}

export function triggerDownload(href: string, filename: string, mimeType?: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  if (mimeType) link.type = mimeType;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadPdfBase64(base64: string, filename: string): void {
  triggerDownload(pdfDownloadHref(base64), projectPdfFilename(filename));
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  const slash = normalized.lastIndexOf("/");
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

export function isUnderPrefix(path: string, prefix: string): boolean {
  const normalized = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);
  if (!normalizedPrefix) return true;
  return normalized === normalizedPrefix || normalized.startsWith(`${normalizedPrefix}/`);
}

export function pathsUnderPrefix(allPaths: string[], prefix: string): string[] {
  return allPaths.filter((path) => isUnderPrefix(path, prefix));
}

export function rewritePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  const normalized = normalizePath(path);
  const oldNorm = normalizePath(oldPrefix);
  const newNorm = normalizePath(newPrefix);

  if (normalized === oldNorm) {
    return newNorm;
  }

  if (normalized.startsWith(`${oldNorm}/`)) {
    const suffix = normalized.slice(oldNorm.length);
    return newNorm ? `${newNorm}${suffix}` : normalized.slice(oldNorm.length + 1);
  }

  return normalized;
}

export type RenameMapResult =
  | { ok: true; map: Map<string, string> }
  | { ok: false; error: string };

export function buildRenameMap(allPaths: string[], from: string, to: string): RenameMapResult {
  const fromNorm = normalizePath(from);
  const toNorm = normalizePath(to);

  if (!fromNorm) {
    return { ok: false, error: "Source path is required" };
  }

  if (fromNorm === toNorm) {
    return { ok: false, error: "Source and destination are the same" };
  }

  const isExactFile = allPaths.includes(fromNorm);
  const children = allPaths.filter((path) => path.startsWith(`${fromNorm}/`));
  const hasPlaceholder = allPaths.includes(folderPlaceholderPath(fromNorm));
  const isFolder = children.length > 0 || hasPlaceholder;

  if (isExactFile && !isFolder) {
    if (allPaths.includes(toNorm)) {
      return { ok: false, error: "Destination already exists" };
    }
    return { ok: true, map: new Map([[fromNorm, toNorm]]) };
  }

  if (isFolder) {
    if (toNorm === fromNorm || toNorm.startsWith(`${fromNorm}/`) || fromNorm.startsWith(`${toNorm}/`)) {
      return { ok: false, error: "Cannot move a folder into itself or a descendant" };
    }

    const affected = allPaths.filter((path) => path === fromNorm || path.startsWith(`${fromNorm}/`));
    if (affected.length === 0) {
      return { ok: false, error: "Path not found" };
    }

    const map = new Map<string, string>();
    for (const path of affected) {
      map.set(path, rewritePathPrefix(path, fromNorm, toNorm));
    }

    const unchanged = new Set(allPaths.filter((path) => !map.has(path)));
    const newPaths = new Set<string>();
    for (const newPath of map.values()) {
      if (unchanged.has(newPath)) {
        return { ok: false, error: `Destination already exists: ${newPath}` };
      }
      if (newPaths.has(newPath)) {
        return { ok: false, error: "Rename would create duplicate paths" };
      }
      newPaths.add(newPath);
    }

    return { ok: true, map };
  }

  if (isExactFile) {
    if (allPaths.includes(toNorm)) {
      return { ok: false, error: "Destination already exists" };
    }
    return { ok: true, map: new Map([[fromNorm, toNorm]]) };
  }

  return { ok: false, error: "Path not found" };
}

export function resolveMainFileAfterRename(mainFile: string, pathMap: Map<string, string>): string {
  const normalized = normalizePath(mainFile);
  if (pathMap.has(normalized)) {
    return pathMap.get(normalized)!;
  }

  for (const [oldPath, newPath] of pathMap) {
    if (normalized === oldPath || normalized.startsWith(`${oldPath}/`)) {
      return rewritePathPrefix(normalized, oldPath, newPath);
    }
  }

  return normalized;
}

export interface ProjectFileEntry {
  path: string;
  content: string;
  isBinary?: boolean;
}

export interface ZipEntry {
  path: string;
  content: string | Uint8Array;
  isBinary: boolean;
}

export function decodeBinaryContent(content: string): Uint8Array {
  const base64 = contentToBase64(content);
  if (!base64) return new Uint8Array();

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function listZipEntries(files: ProjectFileEntry[]): ZipEntry[] {
  return files
    .filter((file) => !isFolderPlaceholder(file.path))
    .map((file) => {
      const isBinary = file.isBinary ?? isBinaryAsset(file.path);
      return {
        path: file.path,
        isBinary,
        content: isBinary ? decodeBinaryContent(file.content) : file.content,
      };
    });
}

export function projectZipFilename(projectName: string): string {
  const withoutExt = projectName.trim().replace(/\.zip$/i, "");
  const sanitized = withoutExt
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const base = sanitized || "manuscript";
  return `${base}.zip`;
}
