import { trimAfterEndDocument, type TexFileInput } from "@/lib/ai-file-context";

/** Target context size for compile-fix prompts (~1k tokens). */
export const AI_COMPILE_FIX_CONTEXT_CHAR_LIMIT = 3_500;

/** Fallback active-file cap when errors have no line numbers. */
export const AI_COMPILE_FIX_ACTIVE_FILE_CHAR_LIMIT = 3_000;

/** Lines of context above and below each cited error location. */
export const AI_COMPILE_FIX_SNIPPET_RADIUS = 15;

export interface AiCompileError {
  message: string;
  file?: string;
  line?: number;
}

export interface BuildAiCompileFixContextOptions {
  errors: AiCompileError[];
  files: TexFileInput[];
  activeFile?: string;
  charLimit?: number;
  snippetRadius?: number;
  /** Retry mode: compile error strings only, no file snippets. */
  errorsOnly?: boolean;
}

const FILE_LINE_MESSAGE_RE = /([^\s():/\\]+\.tex):(\d+)/i;

export function normalizeAiCompileErrors(
  errors?: (string | AiCompileError)[]
): AiCompileError[] {
  if (!errors?.length) return [];
  return errors.map((entry) =>
    typeof entry === "string" ? { message: entry } : { ...entry }
  );
}

export function formatCompileErrorLines(errors: AiCompileError[]): string {
  return errors
    .map((error) => {
      if (error.file && error.line != null) {
        return `${error.file}:${error.line}: ${error.message}`;
      }
      if (error.file) return `${error.file}: ${error.message}`;
      if (error.line != null) return `line ${error.line}: ${error.message}`;
      return error.message;
    })
    .join("\n");
}

export function parseFileLineFromMessage(
  message: string
): { file: string; line: number } | null {
  const match = message.match(FILE_LINE_MESSAGE_RE);
  if (!match?.[1] || !match[2]) return null;

  const lineNum = Number.parseInt(match[2], 10);
  if (!Number.isFinite(lineNum) || lineNum < 1) return null;

  return { file: match[1], line: lineNum };
}

export function extractLineSnippet(
  content: string,
  line: number,
  radius = AI_COMPILE_FIX_SNIPPET_RADIUS
): string {
  const lines = content.split("\n");
  const index = line - 1;
  if (index < 0 || index >= lines.length) {
    return content.slice(0, 500);
  }

  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);

  return lines
    .slice(start, end)
    .map((text, offset) => {
      const lineNum = start + offset + 1;
      const marker = lineNum === line ? ">" : " ";
      return `${marker} ${lineNum}: ${text}`;
    })
    .join("\n");
}

function resolveTexContent(
  fileMap: Map<string, string>,
  file: string
): { path: string; content: string } | null {
  const candidates = [file, file.replace(/^\.\//, ""), file.split("/").pop() ?? file];
  for (const candidate of candidates) {
    const content = fileMap.get(candidate);
    if (content != null) return { path: candidate, content };
  }
  return null;
}

function collectErrorLocations(errors: AiCompileError[]): { file: string; line: number }[] {
  const locations: { file: string; line: number }[] = [];
  const seen = new Set<string>();

  for (const error of errors) {
    const candidates: ({ file: string; line: number } | null)[] = [
      error.file && error.line != null ? { file: error.file, line: error.line } : null,
      parseFileLineFromMessage(error.message),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      const key = `${candidate.file}:${candidate.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      locations.push(candidate);
    }
  }

  return locations;
}

/**
 * Build a compact compile-fix context: error strings plus small snippets around cited file:line.
 * Falls back to a trimmed active file when no line numbers are available.
 */
export function buildAiCompileFixContext(
  options: BuildAiCompileFixContextOptions
): string {
  const {
    errors,
    files,
    activeFile,
    charLimit = AI_COMPILE_FIX_CONTEXT_CHAR_LIMIT,
    snippetRadius = AI_COMPILE_FIX_SNIPPET_RADIUS,
    errorsOnly = false,
  } = options;

  if (errors.length === 0) return "";

  const errorSection = `Compile errors:\n${formatCompileErrorLines(errors)}`;
  if (errorsOnly) return errorSection;

  const fileMap = new Map(
    files
      .filter((file) => file.path.endsWith(".tex"))
      .map((file) => [file.path, trimAfterEndDocument(file.content)])
  );

  const locations = collectErrorLocations(errors);
  const snippets: string[] = [];
  let used = errorSection.length + 2;

  if (locations.length > 0) {
    for (const location of locations) {
      const resolved = resolveTexContent(fileMap, location.file);
      if (!resolved) continue;

      const snippet = extractLineSnippet(resolved.content, location.line, snippetRadius);
      const block = `--- ${resolved.path} (around line ${location.line}) ---\n${snippet}`;
      const separator = snippets.length > 0 ? "\n\n" : "\n\n";
      const cost = separator.length + block.length;
      if (used + cost > charLimit) break;

      snippets.push(block);
      used += cost;
    }
  } else {
    const texFiles = files.filter((file) => file.path.endsWith(".tex"));
    const targetPath =
      activeFile && fileMap.has(activeFile)
        ? activeFile
        : texFiles[0]?.path;
    const content = targetPath ? fileMap.get(targetPath) : undefined;

    if (targetPath && content) {
      const header = `--- ${targetPath} ---\n`;
      const budget = Math.min(
        AI_COMPILE_FIX_ACTIVE_FILE_CHAR_LIMIT,
        charLimit - used - header.length
      );
      if (budget > 0) {
        snippets.push(`${header}${content.slice(0, budget)}`);
      }
    }
  }

  return snippets.length > 0
    ? `${errorSection}\n\n${snippets.join("\n\n")}`
    : errorSection;
}
