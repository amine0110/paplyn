import { AI_PLUGIN_CLIENT_META } from "@/lib/ai-plugins/client-meta";

/** User-selectable tool in the AI chat composer (+ menu). */
export interface ComposerToolOption {
  toolName: string;
  displayName: string;
  placeholder?: string;
}

const PLUGIN_PLACEHOLDERS: Record<string, string> = {
  search_literature: "Paper search query…",
  cite_from_doi: "Paste a DOI (e.g. 10.1038/…)…",
  search_arxiv: "arXiv query or ID…",
  parse_github_repo: "owner/repo or GitHub URL…",
};

const WORKSPACE_COMPOSER_TOOLS: ComposerToolOption[] = [
  { toolName: "list_files", displayName: "List project files" },
  {
    toolName: "get_file",
    displayName: "Read file",
    placeholder: "File path (e.g. main.tex)…",
  },
];

/** Enabled plugins (client meta) plus user-facing workspace read tools. */
export function listComposerToolOptions(): ComposerToolOption[] {
  const plugins: ComposerToolOption[] = AI_PLUGIN_CLIENT_META.map((meta) => ({
    toolName: meta.toolName,
    displayName: meta.name,
    placeholder: PLUGIN_PLACEHOLDERS[meta.toolName],
  }));
  return [...plugins, ...WORKSPACE_COMPOSER_TOOLS];
}

export function getComposerToolByName(toolName: string): ComposerToolOption | undefined {
  return listComposerToolOptions().find((tool) => tool.toolName === toolName);
}

export function buildForcedToolSystemPrompt(toolName: string, displayName: string): string {
  return `The user attached the "${displayName}" tool (${toolName}) to this message. You MUST call ${toolName} as your first tool call, using parameters derived from their message. Do not substitute a different tool. After the tool returns, answer based on the results.`;
}
