/**
 * SyncTeX parser and reverse lookup (PDF click → source line).
 * Parser adapted from synctex-js (MIT) via LaTeX-Workshop:
 * https://github.com/tdurieux/synctex-js
 */

const SYNCTEX_UNIT = 65781.76;
const GZIP_MAGIC = [0x1f, 0x8b];

export interface SynctexBlock {
  type: string;
  fileNumber: number;
  filePath: string;
  line: number;
  left: number;
  bottom: number;
  width?: number;
  height: number;
  page: number;
}

export interface SynctexIndex {
  offset: { x: number; y: number };
  files: Record<string, string>;
  /** page number → blocks with geometry on that page */
  pageBlocks: Record<number, SynctexBlock[]>;
}

export interface SynctexSourceLocation {
  line: number;
  file?: string;
}

class Rectangle {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;

  constructor(top: number, bottom: number, left: number, right: number) {
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
  }

  includes(rect: Rectangle): boolean {
    return (
      this.left <= rect.left &&
      this.right >= rect.right &&
      this.bottom >= rect.bottom &&
      this.top <= rect.top
    );
  }

  distanceFromCenter(x: number, y: number): number {
    const cx = (this.left + this.right) / 2;
    const cy = (this.bottom + this.top) / 2;
    return Math.hypot(cx - x, cy - y);
  }
}

function blockToRect(block: SynctexBlock): Rectangle {
  const top = block.bottom - block.height;
  const bottom = block.bottom;
  const left = block.left;
  const right = block.width !== undefined ? block.left + block.width : block.left;
  return new Rectangle(top, bottom, left, right);
}

/** Parse decompressed SyncTeX file text into a lightweight index. */
export function parseSynctex(text: string): SynctexIndex | null {
  if (!text.trim()) return null;

  const lines = text.split("\n");
  const files: Record<string, string> = {};
  const pageBlocks: Record<number, SynctexBlock[]> = {};
  const offset = { x: 0, y: 0 };

  let currentPage: number | undefined;
  let currentElement: {
    type: string;
    fileNumber: number;
    line: number;
    left: number;
    bottom: number;
    width?: number;
    height: number;
    page: number;
    elements: SynctexBlock[];
  } | null = null;

  const inputPattern = /Input:([0-9]+):(.+)/;
  const offsetPattern = /(X|Y) Offset:([0-9]+)/;
  const openPagePattern = /\{([0-9]+)$/;
  const closePagePattern = /\}([0-9]+)$/;
  const verticalBlockPattern =
    /\[([0-9]+),([0-9]+):(-?[0-9]+),(-?[0-9]+):(-?[0-9]+),(-?[0-9]+),(-?[0-9]+)/;
  const closeVerticalBlockPattern = /\]$/;
  const horizontalBlockPattern =
    /\(([0-9]+),([0-9]+):(-?[0-9]+),(-?[0-9]+):(-?[0-9]+),(-?[0-9]+),(-?[0-9]+)/;
  const closeHorizontalBlockPattern = /\)$/;
  const elementBlockPattern = /(.)([0-9]+),([0-9]+):(-?[0-9]+),(-?[0-9]+)(:?(-?[0-9]+))?/;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    let match = line.match(inputPattern);
    if (match) {
      files[match[1]] = match[2];
      continue;
    }

    match = line.match(offsetPattern);
    if (match) {
      const value = parseInt(match[2], 10) / SYNCTEX_UNIT;
      if (match[1] === "X") offset.x = value;
      else offset.y = value;
      continue;
    }

    match = line.match(openPagePattern);
    if (match) {
      currentPage = parseInt(match[1], 10);
      continue;
    }

    match = line.match(closePagePattern);
    if (match) {
      currentPage = undefined;
      currentElement = null;
      continue;
    }

    match = line.match(verticalBlockPattern);
    if (match && currentPage !== undefined) {
      currentElement = {
        type: "vertical",
        fileNumber: parseInt(match[1], 10),
        line: parseInt(match[2], 10),
        left: Number(match[3]) / SYNCTEX_UNIT,
        bottom: Number(match[4]) / SYNCTEX_UNIT,
        width: Number(match[5]) / SYNCTEX_UNIT,
        height: Number(match[6]) / SYNCTEX_UNIT,
        page: currentPage,
        elements: [],
      };
      continue;
    }

    match = line.match(closeVerticalBlockPattern);
    if (match) {
      currentElement = null;
      continue;
    }

    match = line.match(horizontalBlockPattern);
    if (match && currentPage !== undefined) {
      currentElement = {
        type: "horizontal",
        fileNumber: parseInt(match[1], 10),
        line: parseInt(match[2], 10),
        left: Number(match[3]) / SYNCTEX_UNIT,
        bottom: Number(match[4]) / SYNCTEX_UNIT,
        width: Number(match[5]) / SYNCTEX_UNIT,
        height: Number(match[6]) / SYNCTEX_UNIT,
        page: currentPage,
        elements: [],
      };
      continue;
    }

    match = line.match(closeHorizontalBlockPattern);
    if (match) {
      currentElement = null;
      continue;
    }

    match = line.match(elementBlockPattern);
    if (match && currentPage !== undefined && currentElement) {
      const fileNumber = match[2];
      const filePath = files[fileNumber];
      if (!filePath) continue;

      const block: SynctexBlock = {
        type: match[1],
        fileNumber: parseInt(fileNumber, 10),
        filePath,
        line: parseInt(match[3], 10),
        left: Number(match[4]) / SYNCTEX_UNIT,
        bottom: Number(match[5]) / SYNCTEX_UNIT,
        width: match[7] ? Number(match[7]) / SYNCTEX_UNIT : undefined,
        height: currentElement.height,
        page: currentPage,
      };

      if (block.type === "k" || block.type === "r") continue;

      if (!pageBlocks[currentPage]) pageBlocks[currentPage] = [];
      pageBlocks[currentPage].push(block);
      currentElement.elements.push(block);
    }
  }

  if (Object.keys(pageBlocks).length === 0) return null;

  return { offset, files, pageBlocks };
}

export function isGzipSynctex(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/** Decode base64 SyncTeX bytes (gzip or plain) to UTF-8 text. Node-safe; browser uses DecompressionStream when available. */
export async function decodeSynctexBase64(base64: string): Promise<string | null> {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    if (isGzipSynctex(bytes)) {
      if (typeof DecompressionStream !== "undefined") {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        const buffer = await new Response(stream).arrayBuffer();
        return new TextDecoder("latin1").decode(buffer);
      }

      const { gunzipSync } = await import("zlib");
      return gunzipSync(bytes).toString("latin1");
    }

    return new TextDecoder("latin1").decode(bytes);
  } catch {
    return null;
  }
}

/** Map an absolute SyncTeX input path to a project-relative file path. */
export function resolveSynctexFilePath(
  synctexPath: string,
  projectFiles: string[]
): string | undefined {
  if (projectFiles.includes(synctexPath)) return synctexPath;

  const normalized = synctexPath.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;

  const exactBasename = projectFiles.filter((f) => f === basename || f.endsWith(`/${basename}`));
  if (exactBasename.length === 1) return exactBasename[0];

  const suffixMatches = projectFiles.filter(
    (f) => normalized.endsWith(f) || f.endsWith(basename)
  );
  if (suffixMatches.length === 1) return suffixMatches[0];

  return undefined;
}

/** Reverse SyncTeX: PDF page + point (pt, origin bottom-left) → nearest source line. */
export function findSynctexSource(
  index: SynctexIndex,
  page: number,
  x: number,
  y: number,
  projectFiles: string[] = []
): SynctexSourceLocation | null {
  const blocks = index.pageBlocks[page];
  if (!blocks?.length) return null;

  const x0 = x - index.offset.x;
  const y0 = y - index.offset.y;

  let best: {
    filePath: string;
    line: number;
    distanceFromCenter: number;
    rect: Rectangle;
  } | null = null;

  for (const block of blocks) {
    if (block.type === "k" || block.type === "r") continue;

    const rect = blockToRect(block);
    const distFromCenter = rect.distanceFromCenter(x0, y0);

    if (
      !best ||
      rect.includes(best.rect) ||
      (distFromCenter < best.distanceFromCenter && !rect.includes(best.rect))
    ) {
      best = {
        filePath: block.filePath,
        line: block.line,
        distanceFromCenter: distFromCenter,
        rect,
      };
    }
  }

  if (!best) return null;

  const file = projectFiles.length
    ? resolveSynctexFilePath(best.filePath, projectFiles)
    : best.filePath.split(/[/\\]/).pop();

  return { line: best.line, file };
}

/** Parse base64 synctex payload and locate source for a PDF click. */
export async function synctexLookupFromBase64(
  synctexBase64: string,
  page: number,
  x: number,
  y: number,
  projectFiles: string[] = []
): Promise<SynctexSourceLocation | null> {
  const text = await decodeSynctexBase64(synctexBase64);
  if (!text) return null;

  const index = parseSynctex(text);
  if (!index) return null;

  return findSynctexSource(index, page, x, y, projectFiles);
}
