import { type TexFileInput } from "@/lib/ai-file-context";

export interface AiCompileError {
  message: string;
  file?: string;
  line?: number;
  severity?: "error" | "warning";
}

export interface BuildAiCompileFixContextOptions {
  errors: AiCompileError[];
  files: TexFileInput[];
  activeFile?: string;
  /** Retry mode: compile error strings only, no file path list. */
  errorsOnly?: boolean;
}

const FILE_LINE_MESSAGE_RE = /([^\s():/\\]+\.tex):(\d+)/i;
const MAX_COMPILE_ERROR_MESSAGE_LENGTH = 400;
const MAX_COMPILE_ERRORS = 25;

/** Lines above/below a cited error line for the first targeted get_file call. */
export const COMPILE_FIX_LINE_RADIUS = 10;

/** Maximum get_file calls allowed per compile-fix request (large templates need a few slices). */
export const COMPILE_FIX_MAX_GET_FILE_CALLS = 4;

function truncateCompileErrorMessage(message: string): string {
  if (message.length <= MAX_COMPILE_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_COMPILE_ERROR_MESSAGE_LENGTH)}…`;
}

export function normalizeAiCompileErrors(
  errors?: (string | AiCompileError)[]
): AiCompileError[] {
  if (!errors?.length) return [];

  const normalized = errors.map((entry) => {
    const base = typeof entry === "string" ? { message: entry } : { ...entry };
    return {
      ...base,
      message: truncateCompileErrorMessage(base.message),
    };
  });

  const hasErrors = normalized.some((entry) => entry.severity === "error");
  const filtered = hasErrors
    ? normalized.filter((entry) => entry.severity !== "warning")
    : normalized;

  return filtered.slice(0, MAX_COMPILE_ERRORS);
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

export function resolveCompileErrorLocation(
  error: AiCompileError
): { file: string; line: number } | null {
  if (error.file && error.line != null) {
    return { file: error.file, line: error.line };
  }
  return parseFileLineFromMessage(error.message);
}

export function getPrimaryCompileErrorLocation(
  errors: AiCompileError[]
): { file: string; line: number } | null {
  for (const error of errors) {
    const location = resolveCompileErrorLocation(error);
    if (location) return location;
  }
  return null;
}

export function buildGetFileWindow(
  line: number,
  radius = COMPILE_FIX_LINE_RADIUS
): { startLine: number; endLine: number } {
  return {
    startLine: Math.max(1, line - radius),
    endLine: line + radius,
  };
}

export function buildCompileFixTargetHint(location: {
  file: string;
  line: number;
}): string {
  const { startLine, endLine } = buildGetFileWindow(location.line);
  return (
    `Primary error location: ${location.file}:${location.line}. ` +
    `Your FIRST tool call must be get_file(path="${location.file}", startLine=${startLine}, endLine=${endLine}). ` +
    `Then call replace_lines on that exact line in the FIRST document copy. ` +
    `Do not read other line ranges before attempting an edit. ` +
    `Do not prepend a preamble or invent packages.`
  );
}

/** Hint for fixing multiple cited errors in one turn (rule 3). */
export function buildCompileFixMultiErrorHint(
  errors: AiCompileError[]
): string | undefined {
  const locations = errors
    .map((error) => resolveCompileErrorLocation(error))
    .filter((loc): loc is { file: string; line: number } => loc != null);

  if (locations.length < 2) return undefined;

  const byFile = new Map<string, number[]>();
  for (const { file, line } of locations) {
    const lines = byFile.get(file) ?? [];
    if (!lines.includes(line)) lines.push(line);
    byFile.set(file, lines);
  }

  const parts: string[] = [];
  for (const [file, lines] of byFile) {
    const sorted = [...lines].sort((a, b) => a - b);
    parts.push(`${file} lines ${sorted.join(", ")}`);
  }

  const applyOrder = locations
    .slice()
    .sort((a, b) => b.line - a.line)
    .map((loc) => `${loc.file}:${loc.line}`)
    .join(", ");

  return (
    `Multiple cited errors in the first document copy: ${parts.join("; ")}. ` +
    `Plan every replace_lines against the ORIGINAL file, then apply from the bottom up ` +
    `(highest line first): ${applyOrder}.`
  );
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
  radius = 15
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

function listTexFilePaths(files: TexFileInput[]): string[] {
  return files
    .filter((file) => file.path.endsWith(".tex"))
    .map((file) => file.path)
    .sort();
}

/**
 * Build a compact compile-fix context: error strings plus .tex file paths only.
 * The model must use list_files / get_file to read file contents.
 */
export function buildAiCompileFixContext(
  options: BuildAiCompileFixContextOptions
): string {
  const { errors, files, errorsOnly = false } = options;

  if (errors.length === 0) return "";

  const errorSection = `Compile errors:\n${formatCompileErrorLines(errors)}`;
  if (errorsOnly) return errorSection;

  const paths = listTexFilePaths(files);
  if (paths.length === 0) return errorSection;

  return `${errorSection}\n\nProject .tex files:\n${paths.join("\n")}`;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Compile-fix: send only the latest user turn so prior failed retries do not blow TPM. */
export function selectCompileFixMessages(messages: AiChatMessage[]): AiChatMessage[] {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  if (lastUserIndex < 0) return messages;
  return [messages[lastUserIndex]];
}
