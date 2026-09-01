import { type TexFileInput } from "@/lib/ai-file-context";
import { getFirstLaTeXCopyEndLine } from "@/lib/ai-compile-fix-validation";

const DOCUMENTCLASS_LINE_RE = /^\s*\\documentclass\b/;

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
const MAX_COMPILE_LOG_EXCERPT_CHARS = 12_000;

/** Lines above/below a cited error line for the first targeted get_file call. */
export const COMPILE_FIX_LINE_RADIUS = 10;

/** Minimum end line for compile-fix preload when the cited error is in the first ~30 lines. */
export const COMPILE_FIX_MIN_READ_END_LINE = 30;

/** Maximum get_file calls allowed per compile-fix request (large templates need a few slices). */
export const COMPILE_FIX_MAX_GET_FILE_CALLS = 4;

function truncateCompileErrorMessage(message: string): string {
  if (message.length <= MAX_COMPILE_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_COMPILE_ERROR_MESSAGE_LENGTH)}…`;
}

function normalizeAiCompileErrorEntries(
  errors?: (string | AiCompileError)[]
): AiCompileError[] {
  if (!errors?.length) return [];

  return errors.map((entry) => {
    const base = typeof entry === "string" ? { message: entry } : { ...entry };
    return {
      ...base,
      message: truncateCompileErrorMessage(base.message),
    };
  });
}

export function normalizeAiCompileErrors(
  errors?: (string | AiCompileError)[]
): AiCompileError[] {
  const normalized = normalizeAiCompileErrorEntries(errors);
  if (!normalized.length) return [];

  const hasErrors = normalized.some((entry) => entry.severity === "error");
  const filtered = hasErrors
    ? normalized.filter((entry) => entry.severity !== "warning")
    : normalized;

  return filtered.slice(0, MAX_COMPILE_ERRORS);
}

/** Keep errors and warnings for compile-aware review (warnings-only turns). */
export function normalizeAiCompileDiagnostics(
  errors?: (string | AiCompileError)[]
): AiCompileError[] {
  return normalizeAiCompileErrorEntries(errors).slice(0, MAX_COMPILE_ERRORS);
}

export function truncateCompileLogExcerpt(log?: string): string {
  const trimmed = log?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= MAX_COMPILE_LOG_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_COMPILE_LOG_EXCERPT_CHARS)}…`;
}

export function hasCompileDiagnosticsPayload(options: {
  errors?: AiCompileError[];
  log?: string;
}): boolean {
  return (options.errors?.length ?? 0) > 0 || Boolean(options.log?.trim());
}

export function buildCompileDiagnosticsContext(options: {
  errors: AiCompileError[];
  log?: string;
  /** Include raw log excerpt when structured diagnostics are empty. */
  includeRawLog?: boolean;
}): string {
  const { errors, log, includeRawLog = true } = options;
  const parts: string[] = [];

  if (errors.length > 0) {
    const errorLines = errors.filter((entry) => entry.severity !== "warning");
    const warningLines = errors.filter((entry) => entry.severity === "warning");
    if (errorLines.length > 0) {
      parts.push(`Compile errors:\n${formatCompileErrorLines(errorLines)}`);
    }
    if (warningLines.length > 0) {
      parts.push(`Compile warnings:\n${formatCompileErrorLines(warningLines)}`);
    }
    if (errorLines.length === 0 && warningLines.length === 0) {
      parts.push(`Compile diagnostics:\n${formatCompileErrorLines(errors)}`);
    }
  }

  if (includeRawLog && errors.length === 0) {
    const logExcerpt = truncateCompileLogExcerpt(log);
    if (logExcerpt) {
      parts.push(`Compile log excerpt:\n${logExcerpt}`);
    }
  }

  return parts.join("\n\n");
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

/** True when a line has \\begin{document without a closing brace before {document}. */
export function isBrokenBeginDocumentLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("%")) return false;
  if (!/\\begin\{document/.test(trimmed)) return false;
  return !/^\\begin\{document\}(\s|$|\[)/.test(trimmed);
}

/**
 * Infer the primary fix location in the FIRST document copy when compile logs
 * lack file:line metadata (empty log, generic errors, stacked duplicate templates).
 */
export function inferFirstCopyCompileFixLocation(
  content: string,
  file: string
): { file: string; line: number } | null {
  const lines = content.split("\n");
  const firstCopyEnd = getFirstLaTeXCopyEndLine(content);
  const limit = Math.min(firstCopyEnd, lines.length);

  for (let i = 0; i < limit; i += 1) {
    if (isBrokenBeginDocumentLine(lines[i])) {
      return { file, line: i + 1 };
    }
  }

  let hasDocumentClass = false;
  let firstBeginDocLine: number | null = null;
  let firstUsepackageLine: number | null = null;
  let firstContentLine: number | null = null;

  for (let i = 0; i < limit; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    if (!firstContentLine) firstContentLine = i + 1;
    if (DOCUMENTCLASS_LINE_RE.test(trimmed)) {
      hasDocumentClass = true;
      break;
    }
    if (/\\usepackage/.test(trimmed) && !firstUsepackageLine) {
      firstUsepackageLine = i + 1;
    }
    if (/\\begin\{document/.test(trimmed)) {
      firstBeginDocLine = i + 1;
      break;
    }
  }

  if (!hasDocumentClass) {
    if (firstUsepackageLine != null) return { file, line: firstUsepackageLine };
    if (firstBeginDocLine != null) return { file, line: firstBeginDocLine };
    if (firstContentLine != null) return { file, line: firstContentLine };
  }

  return null;
}

/** Add file/line from message patterns (main.tex:8, l.8) when the compiler omitted them. */
export function enrichCompileErrorsWithLocations(
  errors: AiCompileError[],
  mainFile: string
): AiCompileError[] {
  return errors.map((error) => {
    if (error.file && error.line != null) return error;

    const resolved = resolveCompileErrorLocation(error);
    if (resolved) {
      return { ...error, file: resolved.file, line: resolved.line };
    }

    const lDot = error.message.match(/\bl\.(\d+)\b/);
    if (lDot?.[1]) {
      return { ...error, file: mainFile, line: Number.parseInt(lDot[1], 10) };
    }

    if (error.line != null && !error.file) {
      return { ...error, file: mainFile };
    }

    return error;
  });
}

/** Attach inferred first-copy location to errors that lack any line when log metadata is missing. */
export function attachInferredCompileErrorLocation(
  errors: AiCompileError[],
  location: { file: string; line: number } | null
): AiCompileError[] {
  if (!location || errors.length === 0) return errors;
  if (errors.some((error) => error.line != null)) return errors;

  const [first, ...rest] = errors;
  return [{ ...first, file: location.file, line: location.line }, ...rest];
}

export function prepareCompileErrorsForCompileFix(
  errors: AiCompileError[],
  options: { mainFile: string; mainFileContent?: string }
): {
  errors: AiCompileError[];
  primaryLocation: { file: string; line: number } | null;
} {
  const enriched = enrichCompileErrorsWithLocations(errors, options.mainFile);
  let primaryLocation = getPrimaryCompileErrorLocation(enriched);

  if (!primaryLocation && options.mainFileContent) {
    primaryLocation = inferFirstCopyCompileFixLocation(
      options.mainFileContent,
      options.mainFile
    );
  }

  const withLocation = attachInferredCompileErrorLocation(enriched, primaryLocation);
  const primaryFromPrepared = getPrimaryCompileErrorLocation(withLocation) ?? primaryLocation;

  return { errors: withLocation, primaryLocation: primaryFromPrepared };
}

/** Resolve primary error location from compile errors, with first-copy inference fallback. */
export function resolvePrimaryCompileErrorLocation(
  errors: AiCompileError[],
  options?: { mainFile?: string; mainFileContent?: string }
): { file: string; line: number } | null {
  if (!options?.mainFile) {
    return getPrimaryCompileErrorLocation(errors);
  }
  return prepareCompileErrorsForCompileFix(errors, {
    mainFile: options.mainFile,
    mainFileContent: options.mainFileContent,
  }).primaryLocation;
}

export function buildGetFileWindow(
  line: number,
  radius = COMPILE_FIX_LINE_RADIUS
): { startLine: number; endLine: number } {
  const startLine = Math.max(1, line - radius);
  const endLine = Math.max(line + radius, COMPILE_FIX_MIN_READ_END_LINE);
  return {
    startLine,
    endLine: Math.max(endLine, startLine),
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
    `Then call replace_lines on that exact line in the FIRST document copy (line ${location.line} — ` +
    `if it is a broken \\begin{document without a closing brace, fix that line first before adding \\documentclass). ` +
    `Do not read line ranges past line ${endLine} before attempting an edit. ` +
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
