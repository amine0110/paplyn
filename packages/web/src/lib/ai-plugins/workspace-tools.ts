import { tool } from "ai";
import { z } from "zod";
import {
  validateClientAction,
  type ValidateActionContext,
} from "@/lib/ai-client-actions";

/** Read-only workspace tools (no client-side action). */
export const WORKSPACE_READ_TOOL_NAMES = ["list_files", "get_file"] as const;

/** Tools that return validated client edit actions. */
export const CLIENT_ACTION_TOOL_NAMES = [
  "insert_at_cursor",
  "replace_selection",
  "apply_edit",
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

function normalizeTexPath(path: string): string {
  return path.replace(/^\.\//, "").trim();
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
  const emptyResult = (error: string): ReadTexFileResult => ({
    path: normalized,
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

  const rawContent = texFiles.get(normalized);
  if (rawContent === undefined) {
    return emptyResult(`File "${normalized}" is not in this project.`);
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

  const content = lines
    .slice(windowStart - 1, windowEnd)
    .map((text, offset) => `${windowStart + offset}: ${text}`)
    .join("\n");

  return {
    path: normalized,
    content,
    startLine: windowStart,
    endLine: windowEnd,
    totalLines,
    note: notes.join(" "),
    error: "",
  };
}

export const WORKSPACE_SYSTEM_PROMPT = `You have workspace tools to list, read, and edit the user's LaTeX project:
- list_files — list all .tex file paths in the project
- get_file — read a line range from one .tex file (startLine/endLine are 1-based inclusive; max ${GET_FILE_MAX_LINES} lines per call)
- apply_edit — surgical search/replace in a file (search must match exactly once)
- fix_compile_errors — batch search/replace fixes for compile errors
- insert_at_cursor — insert LaTeX at the user's cursor
- replace_selection — replace the user's editor selection

Workflow: use list_files to discover paths, get_file to read small line windows around errors, then apply_edit or fix_compile_errors to make changes. Apply edits with tools — do not only describe changes in prose.
Only reference .tex files returned by list_files or get_file. Never invent file paths or citations.
Never call tools that are not listed above.
Keep each edit under ${8_000} characters. Prefer minimal, surgical changes.
If an edit is ambiguous (multiple matches, unclear target), ask the user instead of guessing.
After applying edits, briefly explain what changed in your reply.`;

export const COMPILE_FIX_WORKSPACE_SUFFIX = `Focus on fixing compile errors. Use get_file with small line ranges around cited error lines, then fix_compile_errors or apply_edit with exact search/replace from the returned content. Keep edits minimal.`;

export function createWorkspaceTools(ctx: ValidateActionContext) {
  const wrap =
    (type: "insert_at_cursor" | "replace_selection" | "apply_edit" | "fix_compile_errors") =>
    (args: Record<string, unknown>) => {
      const validated = validateClientAction(
        { type, ...args } as Parameters<typeof validateClientAction>[0],
        ctx
      );
      if (!validated) {
        return {
          kind: "client-action-rejected" as const,
          reason: "Edit could not be validated. Check file path, search text, and size limits.",
        };
      }
      return {
        kind: "client-action" as const,
        action: validated.action,
        ...(validated.warning ? { warning: validated.warning } : {}),
      };
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
        readTexFile(ctx.texFiles, path, startLine, endLine),
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
        "Apply a surgical search/replace edit to a named .tex file. The search string must match exactly once.",
      parameters: z.object({
        file: z.string().describe("Project .tex file path, e.g. main.tex"),
        search: z.string().describe("Exact substring to replace"),
        replace: z.string().describe("Replacement text"),
      }),
      execute: async (args) => wrap("apply_edit")(args),
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
