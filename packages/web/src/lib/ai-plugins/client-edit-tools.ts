import { tool } from "ai";
import { z } from "zod";
import {
  validateClientAction,
  type ValidateActionContext,
} from "@/lib/ai-client-actions";

export const CLIENT_EDIT_TOOL_NAMES = [
  "insert_at_cursor",
  "replace_selection",
  "apply_edit",
  "fix_compile_errors",
] as const;

export const CLIENT_EDIT_SYSTEM_PROMPT = `When the user asks you to edit, fix, rewrite, or change their LaTeX manuscript:
- Apply changes with insert_at_cursor, replace_selection, apply_edit, or fix_compile_errors tools — do not only describe edits in prose.
- Use insert_at_cursor for new content at the cursor; replace_selection when changing highlighted text.
- Use apply_edit for surgical search/replace changes in a specific .tex file. The search string must match exactly once.
- Use fix_compile_errors for small LaTeX fixes based on the current compile error list.
- Only reference .tex files that exist in the project context. Never invent file paths or citations.
- Keep each edit under ${8_000} characters. Prefer minimal, surgical changes.
- If an edit is ambiguous (multiple matches, unclear target), ask the user instead of guessing.
- After applying edits, briefly explain what changed in your reply.`;

export function createClientEditTools(ctx: ValidateActionContext) {
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
