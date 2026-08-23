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

export function readTexFile(
  texFiles: Map<string, string>,
  path: string
): { path: string; content: string; error: string } {
  const normalized = normalizeTexPath(path);
  if (!normalized.endsWith(".tex")) {
    return {
      path: normalized,
      content: "",
      error: `File "${normalized}" is not a .tex file in this project.`,
    };
  }

  const content = texFiles.get(normalized);
  if (content === undefined) {
    return {
      path: normalized,
      content: "",
      error: `File "${normalized}" is not in this project.`,
    };
  }

  return {
    path: normalized,
    content,
    error: "",
  };
}

export const WORKSPACE_SYSTEM_PROMPT = `You have workspace tools to list, read, and edit the user's LaTeX project:
- list_files — list all .tex file paths in the project
- get_file — read the full content of one .tex file
- apply_edit — surgical search/replace in a file (search must match exactly once)
- fix_compile_errors — batch search/replace fixes for compile errors
- insert_at_cursor — insert LaTeX at the user's cursor
- replace_selection — replace the user's editor selection

Workflow: use list_files or get_file to inspect files, then apply_edit, fix_compile_errors, insert_at_cursor, or replace_selection to make changes. Apply edits with tools — do not only describe changes in prose.
Only reference .tex files returned by list_files or get_file. Never invent file paths or citations.
Never call tools that are not listed above.
Keep each edit under ${8_000} characters. Prefer minimal, surgical changes.
If an edit is ambiguous (multiple matches, unclear target), ask the user instead of guessing.
After applying edits, briefly explain what changed in your reply.`;

export const COMPILE_FIX_WORKSPACE_SUFFIX = `Focus on fixing compile errors. Use list_files or get_file to inspect sources, then fix_compile_errors or apply_edit with exact search/replace from file contents. Keep edits minimal.`;

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
        "Read the full content of one project .tex file from the workspace. Use before apply_edit or fix_compile_errors when you need more than a snippet.",
      parameters: z.object({
        path: z.string().describe("Project .tex file path, e.g. main.tex"),
      }),
      execute: async ({ path }) => readTexFile(ctx.texFiles, path),
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
