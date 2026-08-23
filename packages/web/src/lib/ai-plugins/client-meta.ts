import { detectFixCompileIntent } from "@/lib/ai-compile-fix-intent";

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

const EDIT_ACTIONS = new Set([
  "explain-errors",
  "tighten",
  "rephrase",
  "improve",
  "shorten",
  "expand",
  "correct",
  "write",
]);

export function loadingLabelForAction(action?: string, userMessage?: string): string {
  const literature = loadingLabelForLiteratureAction(action, userMessage);
  if (literature) return literature;

  if (action === "explain-errors" || detectFixCompileIntent(userMessage ?? "", action)) {
    return "Fixing compile errors…";
  }

  if (action && EDIT_ACTIONS.has(action)) {
    return "Applying edit…";
  }

  const lower = (userMessage ?? "").toLowerCase();
  if (
    lower.includes("edit") ||
    lower.includes("fix") ||
    lower.includes("insert") ||
    lower.includes("replace") ||
    lower.includes("change")
  ) {
    return "Applying edit…";
  }

  return "Thinking…";
}
