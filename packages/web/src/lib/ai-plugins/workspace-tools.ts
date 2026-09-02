import { tool } from "ai";
import { z } from "zod";
import {
  applyValidatedClientActionToContent,
  validateClientAction,
  type AiClientAction,
  type ValidateActionContext,
} from "@/lib/ai-client-actions";
import {
  buildCompileDiagnosticsContext,
  buildGetFileWindow,
  COMPILE_FIX_GET_FILE_BEFORE_EDIT,
  truncateCompileLogExcerpt,
  type AiCompileError,
} from "@/lib/ai-compile-fix-context";

/** Read-only workspace tools (no client-side action). */
export const WORKSPACE_READ_TOOL_NAMES = [
  "list_files",
  "get_file",
  "get_compile_diagnostics",
] as const;

/** Tools that return validated client edit actions. */
export const CLIENT_ACTION_TOOL_NAMES = [
  "insert_at_cursor",
  "replace_selection",
  "apply_edit",
  "replace_lines",
  "fix_compile_errors",
] as const;

/** Full workspace toolkit available in every AI request. */
export const WORKSPACE_TOOL_NAMES = [
  ...WORKSPACE_READ_TOOL_NAMES,
  ...CLIENT_ACTION_TOOL_NAMES,
] as const;

/** Maximum inclusive line window returned by get_file. */
export const GET_FILE_MAX_LINES = 100;

/** @deprecated Use CLIENT_ACTION_TOOL_NAMES — kept for ai-response helpers. */
export const CLIENT_EDIT_TOOL_NAMES = CLIENT_ACTION_TOOL_NAMES;

export const GET_FILE_RETRY_ATTEMPTS = 3;
export const GET_FILE_RETRY_DELAY_MS = 75;

export function normalizeTexPath(path: string): string {
  return path.trim().replace(/^\.\//, "").replace(/^\/+/, "");
}

export function resolveTexFilePath(
  texFiles: Map<string, string>,
  path: string
): string | null {
  const normalized = normalizeTexPath(path);
  if (!normalized.endsWith(".tex")) return null;

  if (texFiles.has(normalized)) {
    return normalized;
  }

  const basename = normalized.split("/").pop() ?? normalized;
  const matches = [...texFiles.keys()].filter(
    (key) => key === basename || key.endsWith(`/${basename}`)
  );
  if (matches.length === 1) {
    return matches[0]!;
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatGetFileRetryError(
  requestedPath: string,
  texFiles: Map<string, string>,
  lastError: string
): string {
  const available = [...texFiles.keys()].sort();
  const pathsHint =
    available.length > 0 ? available.join(", ") : "(no .tex files in project)";
  const base =
    lastError.length > 0
      ? lastError
      : `Could not read "${normalizeTexPath(requestedPath)}".`;
  return `${base} Retry get_file with one of these exact project paths: ${pathsHint}.`;
}

function isReadableGetFileResult(result: ReadTexFileResult): boolean {
  return result.error.length === 0 && result.totalLines > 0;
}

export function isGetFileLimitError(error: string): boolean {
  return error.includes("get_file limit reached");
}

type LineCoverageRange = { start: number; end: number };

function recordLineCoverage(
  coverage: Map<string, LineCoverageRange[]>,
  texFiles: Map<string, string>,
  path: string,
  startLine: number,
  endLine: number
): void {
  const resolved = resolveTexFilePath(texFiles, path) ?? normalizeTexPath(path);
  const ranges = coverage.get(resolved) ?? [];
  ranges.push({ start: startLine, end: endLine });
  coverage.set(resolved, ranges);
}

function isLineCovered(
  coverage: Map<string, LineCoverageRange[]>,
  texFiles: Map<string, string>,
  path: string,
  line: number
): boolean {
  const resolved = resolveTexFilePath(texFiles, path) ?? normalizeTexPath(path);
  const ranges = coverage.get(resolved);
  if (!ranges?.length) return false;
  return ranges.some((range) => line >= range.start && line <= range.end);
}

/** Merge refreshed DB snapshot without wiping tex content we already read this turn. */
function mergeTexFilesPreservingReads(
  previous: Map<string, string>,
  refreshed: Map<string, string>
): Map<string, string> {
  const merged = new Map(refreshed);
  for (const [path, content] of previous) {
    const next = merged.get(path);
    if (next == null || next.length === 0) {
      if (content.length > 0) merged.set(path, content);
    }
  }
  return merged;
}

export function listTexFiles(texFiles: Map<string, string>): {
  files: string[];
  count: number;
  error: string;
} {
  const files = [...texFiles.keys()].sort();
  return {
    files,
    count: files.length,
    error: "",
  };
}

export interface ReadTexFileResult {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  note: string;
  error: string;
}

export function readTexFile(
  texFiles: Map<string, string>,
  path: string,
  startLine: number,
  endLine: number
): ReadTexFileResult {
  const normalized = normalizeTexPath(path);
  const emptyResult = (error: string, resolvedPath = normalized): ReadTexFileResult => ({
    path: resolvedPath,
    content: "",
    startLine: 1,
    endLine: 1,
    totalLines: 0,
    note: "",
    error,
  });

  if (!normalized.endsWith(".tex")) {
    return emptyResult(`File "${normalized}" is not a .tex file in this project.`);
  }

  const resolvedPath = resolveTexFilePath(texFiles, path);
  if (!resolvedPath) {
    return emptyResult(`File "${normalized}" is not in this project.`);
  }

  const rawContent = texFiles.get(resolvedPath);
  if (rawContent === undefined) {
    return emptyResult(`File "${resolvedPath}" is not in this project.`, resolvedPath);
  }

  const lines = rawContent.split("\n");
  const totalLines = Math.max(lines.length, 1);

  if (!Number.isFinite(startLine) || !Number.isFinite(endLine) || startLine < 1 || endLine < 1) {
    return emptyResult("startLine and endLine must be positive integers (1-based).");
  }

  let windowStart = Math.min(startLine, totalLines);
  let windowEnd = Math.min(endLine, totalLines);
  if (windowEnd < windowStart) {
    windowEnd = windowStart;
  }

  const notes: string[] = [];
  if (startLine > totalLines) {
    notes.push(`startLine ${startLine} is past the end of the file (${totalLines} lines).`);
    windowStart = totalLines;
    windowEnd = totalLines;
  }

  const requestedSpan = windowEnd - windowStart + 1;
  if (requestedSpan > GET_FILE_MAX_LINES) {
    windowEnd = windowStart + GET_FILE_MAX_LINES - 1;
    notes.push(
      `Window capped to ${GET_FILE_MAX_LINES} lines. Call get_file again with a different startLine/endLine to read more.`
    );
  }

  if (windowEnd < totalLines) {
    notes.push(`File has ${totalLines} lines total. Lines ${windowEnd + 1}-${totalLines} not shown.`);
  }
  if (windowStart > 1) {
    notes.push(`Lines 1-${windowStart - 1} not shown.`);
  }

  const content = lines.slice(windowStart - 1, windowEnd).join("\n");

  return {
    path: resolvedPath,
    content,
    startLine: windowStart,
    endLine: windowEnd,
    totalLines,
    note: notes.join(" "),
    error: "",
  };
}

export const WORKSPACE_SYSTEM_PROMPT = `You are a workspace agent for this LaTeX project. You have tools to list, read, and edit files:
- list_files — list all .tex file paths in the project
- get_file — read a line range from one .tex file (content is raw file text; line numbers are in startLine/endLine/totalLines; max ${GET_FILE_MAX_LINES} lines per call)
- get_compile_diagnostics — return the latest compile errors, warnings, and log excerpt from the project (never ask the user to paste logs)
- apply_edit — surgical search/replace in a file (search must match exactly once)
- replace_lines — replace a 1-based inclusive line range without substring search (prefer when compile errors cite a line number)
- fix_compile_errors — batch search/replace fixes for compile errors
- insert_at_cursor — insert LaTeX at the user's cursor
- replace_selection — replace the user's editor selection

When the user states a fact about the paper or asks you to change something (affiliation, university, institution, author, title, abstract, adding/removing/rewording text, etc.), you MUST apply the change with apply_edit or replace_lines after locating the relevant span. Answer questions in prose; change requests get edits — do not only describe changes.

Add vs fill intent (every field, every paper):
- ADD / insert / append something new → insert a new line or span where it belongs.
- FILL / replace / update / change, or the user states a fact about existing content ("the X is Y", "set X to Y", typos included) → overwrite the existing value IN PLACE. Replace the line or unique substring that already holds the old value. Do not duplicate. Do not leave the old value on the line above or beside the new one.
- apply_edit when the search matches once. If rejected for multiple matches, use replace_lines on the specific line that contains the old value — not on a blank or following line.

Do not spend the whole turn reading overlapping get_file windows of the same file. Read one useful window, then edit. If the field is not in that window, read a different range once — then edit or say you could not find it.

Workflow: use list_files to discover paths, get_file to read small line windows, then replace_lines (when errors cite a line), apply_edit, or fix_compile_errors to make changes.
Only reference .tex files returned by list_files or get_file. Never invent file paths or citations.
Never call tools that are not listed above.
Keep each edit under ${8_000} characters. Prefer minimal, surgical changes.
When compile errors cite a line number, use replace_lines — apply_edit often fails on repeated lines in large templates.
If apply_edit is rejected (0 or multiple matches), use replace_lines for the cited line range.
After applying edits, reply with a short human sentence about what changed. Never put raw tool logs in your reply.`;

/** Extra guidance for general chat (non compile-fix) turns. */
export const WORKSPACE_CHAT_SUFFIX = `Treat user messages that state or request a change to the paper as edit requests: locate the field in the project .tex files, apply_edit or replace_lines, then confirm briefly in your reply. Distinguish add (insert new) from fill/replace (overwrite the existing value in place — never stack a new line next to an unreplaced old value).`;

export const NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX = `Never invent placeholder manuscript content to silence undefined references or citations.

For undefined \\ref/\\label:
- Search the project for an existing figure, table, or section with that content. If found, add the missing \\label on that float or heading.
- If the float or section does not exist, say which label is missing — do NOT create placeholder tables, figures, or sections.

For undefined citations:
- Check the project's .bib files for the citation key. If the key exists, fix \\cite, \\bibliography, or natbib wiring.
- If the key is absent, list the missing keys — do NOT invent \\bibitem entries, stub bibliographies, or dummy papers.

If you cannot make a surgical fix that should reduce the actual error or warning, return no edit and explain what is missing. Do not apply an edit that adds dummy content or makes the compile worse.`;

export const COMPILE_DIAGNOSTICS_WORKSPACE_SUFFIX = `The latest compile result is already attached to this request or available via get_compile_diagnostics. Use those diagnostics directly — never ask the user to paste compile logs, errors, or warnings. If no compile has run yet, tell them to compile the project first (one short sentence).

When fixing warnings, undefined refs, or undefined citations from the compile output:
${NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX}`;

export const COMPILE_DIAGNOSTICS_REVIEW_SUFFIX = `The user is asking about compile warnings or the compile log. Your FIRST step is to read the attached compile diagnostics or call get_compile_diagnostics — do NOT read project source with get_file/list_files to guess warnings.

Reply by quoting the actual compiler output only (file:line when present, plus the compiler's exact warning text). If there are no warnings in the diagnostics, say the last compile had none.

When the user asks to fix warnings or undefined refs/cites:
${NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX}

Forbidden:
- Do NOT invent a catalog of "typical" LaTeX warnings.
- Do NOT say "you'll typically see", "when the file is compiled you will see", or similar.
- Do NOT describe warnings that are not present in the attached diagnostics or get_compile_diagnostics result.
- Do NOT analyze source to predict warnings before reading diagnostics.
- Do NOT insert placeholder tables, figures, sections, or minimal bibliographies to silence undefined refs/cites.`;

export const COMPILE_FIX_WORKSPACE_SUFFIX = `Focus on fixing compile errors in the FIRST document copy only (from the first \\\\documentclass through the first \\\\end{document}). pdflatex stops at the first \\\\end{document} — ignore duplicate templates pasted after it.

${NO_DUMMY_MANUSCRIPT_CONTENT_SUFFIX}

Rules:
1. Never put \\\\usepackage, \\\\title, or body content before \\\\documentclass. Repair the cited line — do not prepend a new preamble or smash multiple commands onto one line.
2. Prefer replace_lines on the exact cited line in the first copy. Do not invent packages except \\\\usepackage{natbib} when the compile error is undefined \\\\citep or \\\\citet (insert it immediately after an existing \\\\usepackage in the first copy). Fixing a bare \\\\usepackage line is allowed. For \\\\citep/\\\\citet errors you may also replace ALL occurrences with \\\\cite in one edit.
3. When several errors cite line numbers, plan ALL replace_lines against the ORIGINAL file (before any edits) and apply from the highest line number downward so line numbers stay valid. Attempt every cited error in the first copy in one turn when possible.
4. Your FIRST get_file must be a small window around the cited error line (see Primary error location) — not overlapping lines 1–100. After at most ${COMPILE_FIX_GET_FILE_BEFORE_EDIT} get_file calls you must call replace_lines, apply_edit, or fix_compile_errors.
5. In your reply, state exactly which lines you changed (e.g. "Changed main.tex line 3."). If an edit is rejected, quote the rejection reason — never claim a fix after a rejected or unsafe edit.

Use fix_compile_errors or apply_edit only when search text matches exactly once. Keep edits minimal.`;

export interface WorkspaceToolsOptions {
  /** Cap get_file calls (compile-fix fast path). */
  maxGetFileCalls?: number;
  /** Called after each get_file invocation. */
  onGetFileCall?: (call: { path: string; startLine: number; endLine: number }) => void;
  /** Enable compile-fix edit guards (preamble order, first copy, package invention). */
  compileFix?: boolean;
  /** Reject placeholder tables/figures/bibliography for compile/warning fixes. */
  manuscriptGuards?: boolean;
  /** Primary cited error location for compile-fix preload. */
  citedErrorLocation?: { file: string; line: number } | null;
  /** Refresh project files between get_file retries (compile-fix DB race). */
  refreshTexFiles?: () => Promise<Map<string, string>>;
  /** Latest compile diagnostics for get_compile_diagnostics. */
  compileDiagnostics?: {
    errors: AiCompileError[];
    log?: string;
  };
  /** Active compile errors for package allowlist validation. */
  compileErrors?: AiCompileError[];
}

export function createWorkspaceTools(
  ctx: ValidateActionContext,
  options: WorkspaceToolsOptions = {}
) {
  const wrap =
    (
      type:
        | "insert_at_cursor"
        | "replace_selection"
        | "apply_edit"
        | "replace_lines"
        | "fix_compile_errors"
    ) =>
    (args: Record<string, unknown>) => {
      if (compileFix && citedErrorLocation) {
        const steerTypes = new Set(["apply_edit", "fix_compile_errors"]);
        if (steerTypes.has(type)) {
          const citedFile = citedErrorLocation.file;
          const citedLine = citedErrorLocation.line;
          if (!isLineCovered(readLineCoverage, validateCtx.texFiles, citedFile, citedLine)) {
            const reason =
              `Could not read ${citedFile} around line ${citedLine} in this turn. ` +
              `Use replace_lines(file="${citedFile}", startLine=${citedLine}, endLine=${citedLine}, replace="...") ` +
              `on the cited compile-error line instead of ${type}.`;
            return {
              kind: "client-action-rejected" as const,
              reason,
            };
          }
        }
      }

      const validated = validateClientAction(
        { type, ...args } as Parameters<typeof validateClientAction>[0],
        validateCtx
      );
      if ("rejected" in validated) {
        return {
          kind: "client-action-rejected" as const,
          reason: validated.reason,
          ...(validated.matchCount !== undefined ? { matchCount: validated.matchCount } : {}),
          ...(validated.matchLineNumbers && validated.matchLineNumbers.length > 0
            ? { matchLineNumbers: validated.matchLineNumbers }
            : {}),
          ...(validated.searchPreview ? { searchPreview: validated.searchPreview } : {}),
          ...(validated.emptySearch ? { emptySearch: true } : {}),
        };
      }
      if (compileFix) {
        applyValidatedActionToTexFiles(validated.action);
      }
      return {
        kind: "client-action" as const,
        action: validated.action,
        ...(validated.warning ? { warning: validated.warning } : {}),
      };
    };

  const { maxGetFileCalls, onGetFileCall, compileFix, manuscriptGuards, citedErrorLocation, refreshTexFiles, compileDiagnostics, compileErrors } =
    options;
  const validateCtx: ValidateActionContext = { ...ctx, compileFix, manuscriptGuards, compileErrors };
  let getFileCallCount = 0;
  const readLineCoverage: Map<string, LineCoverageRange[]> = new Map();

  const applyValidatedActionToTexFiles = (action: AiClientAction) => {
    switch (action.type) {
      case "apply_edit":
      case "replace_lines": {
        const content = validateCtx.texFiles.get(action.file);
        if (content == null) return;
        const updated = applyValidatedClientActionToContent(content, action);
        if (updated != null) validateCtx.texFiles.set(action.file, updated);
        break;
      }
      case "fix_compile_errors": {
        for (const edit of action.edits) {
          const content = validateCtx.texFiles.get(edit.file);
          if (content == null) continue;
          const updated = applyValidatedClientActionToContent(content, {
            type: "apply_edit",
            file: edit.file,
            search: edit.search,
            replace: edit.replace,
            label: "",
          });
          if (updated != null) validateCtx.texFiles.set(edit.file, updated);
        }
        break;
      }
      default:
        break;
    }
  };

  const citedFilePreload = (() => {
    if (!compileFix || !citedErrorLocation) return null;
    const resolved = resolveTexFilePath(ctx.texFiles, citedErrorLocation.file);
    if (!resolved) return null;
    const { startLine, endLine } = buildGetFileWindow(citedErrorLocation.line);
    const preload = readTexFile(ctx.texFiles, resolved, startLine, endLine);
    if (isReadableGetFileResult(preload)) {
      recordLineCoverage(readLineCoverage, ctx.texFiles, preload.path, preload.startLine, preload.endLine);
      return preload;
    }
    return null;
  })();

  const readTexFileWithRetry = async ({
    path,
    startLine,
    endLine,
  }: {
    path: string;
    startLine: number;
    endLine: number;
  }): Promise<ReadTexFileResult> => {
    let lastResult = readTexFile(ctx.texFiles, path, startLine, endLine);

    for (let attempt = 1; attempt < GET_FILE_RETRY_ATTEMPTS; attempt += 1) {
      if (isReadableGetFileResult(lastResult)) {
        return lastResult;
      }

      const resolvedPath = resolveTexFilePath(ctx.texFiles, path);
      const normalized = normalizeTexPath(path);
      const shouldRetry =
        resolvedPath != null ||
        (refreshTexFiles != null && normalized.endsWith(".tex"));

      if (!shouldRetry) {
        return {
          ...lastResult,
          error: formatGetFileRetryError(path, ctx.texFiles, lastResult.error),
        };
      }

      if (refreshTexFiles) {
        const previous = new Map(ctx.texFiles);
        const refreshed = await refreshTexFiles();
        ctx.texFiles = mergeTexFilesPreservingReads(previous, refreshed);
      }

      await sleep(GET_FILE_RETRY_DELAY_MS);
      lastResult = readTexFile(ctx.texFiles, path, startLine, endLine);
    }

    if (isReadableGetFileResult(lastResult)) {
      return lastResult;
    }

    return {
      ...lastResult,
      error: formatGetFileRetryError(path, ctx.texFiles, lastResult.error),
    };
  };

  const wrapGetFile = async ({
    path,
    startLine,
    endLine,
  }: {
    path: string;
    startLine: number;
    endLine: number;
  }) => {
    const getFileBudget =
      compileFix ? COMPILE_FIX_GET_FILE_BEFORE_EDIT : maxGetFileCalls;

    if (getFileBudget != null && getFileCallCount >= getFileBudget) {
      const citedLine = citedErrorLocation?.line;
      const citedHint =
        citedLine != null
          ? ` Use replace_lines on ${citedErrorLocation?.file ?? path} line ${citedLine} now.`
          : " Use replace_lines on the cited error line now.";
      const budgetMessage = compileFix
        ? `get_file budget used (${COMPILE_FIX_GET_FILE_BEFORE_EDIT} reads per compile-fix turn). ` +
          `You must call replace_lines, apply_edit, or fix_compile_errors before reading more.${citedHint}`
        : `get_file limit reached (${getFileBudget} calls). Use replace_lines on the cited error line or apply_edit now.`;
      return {
        path,
        content: "",
        startLine,
        endLine,
        totalLines: 0,
        note: "",
        error: budgetMessage,
      };
    }

    let readStartLine = startLine;
    let readEndLine = endLine;
    let steerNote = "";

    if (compileFix && citedErrorLocation && getFileCallCount === 0) {
      const resolved = resolveTexFilePath(ctx.texFiles, path);
      const citedResolved = resolveTexFilePath(ctx.texFiles, citedErrorLocation.file);
      if (resolved && citedResolved === resolved) {
        const citedWindow = buildGetFileWindow(citedErrorLocation.line);
        if (readStartLine !== citedWindow.startLine || readEndLine !== citedWindow.endLine) {
          readStartLine = citedWindow.startLine;
          readEndLine = citedWindow.endLine;
          steerNote =
            `Steered to cited error window (lines ${readStartLine}–${readEndLine} around line ${citedErrorLocation.line}). ` +
            `Do not request overlapping 1–${GET_FILE_MAX_LINES} windows before editing. `;
        }
      }
    }

    getFileCallCount += 1;
    onGetFileCall?.({ path, startLine: readStartLine, endLine: readEndLine });

    if (
      citedFilePreload &&
      resolveTexFilePath(ctx.texFiles, path) === citedFilePreload.path
    ) {
      const citedRead = readTexFile(ctx.texFiles, path, readStartLine, readEndLine);
      if (isReadableGetFileResult(citedRead)) {
        recordLineCoverage(
          readLineCoverage,
          ctx.texFiles,
          citedRead.path,
          citedRead.startLine,
          citedRead.endLine
        );
        return steerNote ? { ...citedRead, note: `${steerNote}${citedRead.note}`.trim() } : citedRead;
      }
    }

    const result = await readTexFileWithRetry({ path, startLine: readStartLine, endLine: readEndLine });
    if (isReadableGetFileResult(result)) {
      recordLineCoverage(
        readLineCoverage,
        ctx.texFiles,
        result.path,
        result.startLine,
        result.endLine
      );
    }
    return steerNote ? { ...result, note: `${steerNote}${result.note}`.trim() } : result;
  };

  return {
    list_files: tool({
      description:
        "List all .tex file paths in the current project workspace. Use before get_file when you need to discover available files.",
      parameters: z.object({
        scope: z
          .enum(["project"])
          .describe("File scope; use 'project' to list all .tex files"),
      }),
      execute: async () => listTexFiles(ctx.texFiles),
    }),
    get_file: tool({
      description:
        `Read a line range from one project .tex file. startLine and endLine are 1-based inclusive. At most ${GET_FILE_MAX_LINES} lines are returned per call — request another range to read more.`,
      parameters: z.object({
        path: z.string().describe("Project .tex file path, e.g. main.tex"),
        startLine: z
          .number()
          .int()
          .min(1)
          .describe("First line to read (1-based inclusive)"),
        endLine: z
          .number()
          .int()
          .min(1)
          .describe("Last line to read (1-based inclusive)"),
      }),
      execute: async ({ path, startLine, endLine }) =>
        wrapGetFile({ path, startLine, endLine }),
    }),
    get_compile_diagnostics: tool({
      description:
        "Return the latest compile errors, warnings, and log excerpt from the project's most recent compile. Use this when the user asks about warnings, overfull boxes, or the compile log — never ask them to paste logs.",
      parameters: z.object({
        scope: z
          .enum(["latest"])
          .describe("Use 'latest' for the most recent compile result"),
      }),
      execute: async () => {
        const errors = compileDiagnostics?.errors ?? [];
        const log = truncateCompileLogExcerpt(compileDiagnostics?.log);
        return {
          errors,
          warnings: errors.filter((entry) => entry.severity === "warning"),
          errorCount: errors.filter((entry) => entry.severity !== "warning").length,
          warningCount: errors.filter((entry) => entry.severity === "warning").length,
          logExcerpt: log,
          formatted: buildCompileDiagnosticsContext({
            errors,
            log,
            includeRawLog: errors.length === 0,
          }),
          error:
            errors.length === 0 && !log
              ? "No compile diagnostics yet. Ask the user to compile the project first."
              : "",
        };
      },
    }),
    insert_at_cursor: tool({
      description:
        "Insert LaTeX text at the user's cursor in the active editor. Use for adding new content.",
      parameters: z.object({
        text: z.string().describe("LaTeX text to insert at the cursor"),
      }),
      execute: async (args) => wrap("insert_at_cursor")(args),
    }),
    replace_selection: tool({
      description:
        "Replace the user's current editor selection with new LaTeX text. Use when rewriting highlighted text.",
      parameters: z.object({
        text: z.string().describe("Replacement LaTeX text"),
      }),
      execute: async (args) => wrap("replace_selection")(args),
    }),
    apply_edit: tool({
      description:
        "Apply a surgical search/replace edit to a named .tex file. The search string must match exactly once. For fill/replace intent, search the existing value and replace it in place — do not leave the old text and add a duplicate nearby. If rejected (0 or multiple matches), use replace_lines on the line that holds the old value, not a blank or following line.",
      parameters: z.object({
        file: z.string().describe("Project .tex file path, e.g. main.tex"),
        search: z.string().describe("Exact substring to replace"),
        replace: z.string().describe("Replacement text"),
      }),
      execute: async (args) => wrap("apply_edit")(args),
    }),
    replace_lines: tool({
      description:
        "Replace a 1-based inclusive line range in a .tex file without unique substring search. For fill/replace intent, target the line that already holds the old value and overwrite it — do not write the new value on the next line and leave the old one. Use when compile errors cite a line number or apply_edit is ambiguous (replace the specific matching line, not a sibling).",
      parameters: z.object({
        file: z.string().describe("Project .tex file path, e.g. main.tex"),
        startLine: z
          .number()
          .int()
          .min(1)
          .describe("First line to replace (1-based inclusive)"),
        endLine: z
          .number()
          .int()
          .min(1)
          .describe("Last line to replace (1-based inclusive)"),
        replace: z
          .string()
          .describe("Replacement text for the line range (empty string deletes the lines)"),
      }),
      execute: async (args) => wrap("replace_lines")(args),
    }),
    fix_compile_errors: tool({
      description:
        "Apply small surgical LaTeX fixes for the current compile errors. Each edit must use an exact search string that appears once.",
      parameters: z.object({
        edits: z
          .array(
            z.object({
              file: z.string().describe(".tex file path"),
              search: z.string().describe("Exact broken snippet to replace"),
              replace: z.string().describe("Corrected snippet"),
            })
          )
          .min(1)
          .max(8),
      }),
      execute: async (args) => wrap("fix_compile_errors")(args),
    }),
  };
}

/** @deprecated Use createWorkspaceTools */
export const createClientEditTools = createWorkspaceTools;
