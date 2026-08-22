/** Client-safe plugin labels (no server-only imports). */

export interface AiPluginClientMeta {
  id: string;
  name: string;
  toolName: string;
  /** Shown while the plugin tool is running. */
  loadingLabel: string;
}

export const AI_PLUGIN_CLIENT_META: AiPluginClientMeta[] = [
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    toolName: "search_literature",
    loadingLabel: "Searching Semantic Scholar…",
  },
];

export function getClientPluginMetaByToolName(toolName: string): AiPluginClientMeta | undefined {
  return AI_PLUGIN_CLIENT_META.find((plugin) => plugin.toolName === toolName);
}

export function loadingLabelForLiteratureAction(action?: string, userMessage?: string): string | null {
  if (action === "find-papers" || action === "citation") {
    return getClientPluginMetaByToolName("search_literature")?.loadingLabel ?? null;
  }

  const lower = (userMessage ?? "").toLowerCase();
  if (
    lower.includes("paper") ||
    lower.includes("literature") ||
    lower.includes("citation") ||
    lower.includes("related work")
  ) {
    return getClientPluginMetaByToolName("search_literature")?.loadingLabel ?? null;
  }

  return null;
}
