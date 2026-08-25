import { tool } from "ai";
import { z } from "zod";
import { GitHubImportError, parseGitHubRepoInput } from "@/lib/github-import";
import type { AiPlugin } from "./types";

const SYSTEM_PROMPT = `When the user asks to open or import a public GitHub LaTeX repository:
- Explain that GitHub import creates a new project from the dashboard Import from GitHub dialog.
- Only public repositories without authentication are supported.
- Do not claim to import private repositories.`;

export const githubImportPlugin: AiPlugin = {
  id: "github-import",
  name: "GitHub",
  description: "Import public GitHub repositories containing LaTeX sources into a new project.",
  toolName: "parse_github_repo",
  enabled: true,
  landing: {
    href: "https://github.com/",
    wordmark: "GitHub",
    wordmarkClassName: "font-semibold",
    caption: "Public .tex repos",
  },
  systemPrompt: SYSTEM_PROMPT,
  createTool: () =>
    tool({
      description:
        "Validate a public GitHub repository reference for LaTeX import. Use when the user mentions importing from GitHub.",
      parameters: z.object({
        repo: z.string().describe("GitHub owner/repo slug or github.com URL"),
      }),
      execute: async ({ repo }) => {
        const parsed = parseGitHubRepoInput(repo);
        if (!parsed) {
          return {
            kind: "github-repo" as const,
            summary: "Invalid GitHub repository URL or owner/repo slug.",
            error: "Invalid GitHub repository URL or owner/repo slug.",
          };
        }

        try {
          return {
            kind: "github-repo" as const,
            summary: `Use Dashboard → Import from GitHub to open ${parsed.owner}/${parsed.repo}. Public repositories only.`,
            owner: parsed.owner,
            repo: parsed.repo,
          };
        } catch (error) {
          const message =
            error instanceof GitHubImportError
              ? error.message
              : error instanceof Error
                ? error.message
                : "GitHub import failed";
          return {
            kind: "github-repo" as const,
            summary: message,
            error: message,
          };
        }
      },
    }),
};
