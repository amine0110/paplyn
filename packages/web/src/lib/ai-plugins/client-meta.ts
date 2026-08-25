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
  {
    id: "cite-doi",
    name: "Crossref",
    toolName: "cite_from_doi",
    loadingLabel: "Resolving DOI…",
  },
  {
    id: "arxiv",
    name: "arXiv",
    toolName: "search_arxiv",
    loadingLabel: "Searching arXiv…",
  },
  {
    id: "github-import",
    name: "GitHub",
    toolName: "parse_github_repo",
    loadingLabel: "Checking GitHub repo…",
  },
];

export function getClientPluginMetaByToolName(toolName: string): AiPluginClientMeta | undefined {
  return AI_PLUGIN_CLIENT_META.find((plugin) => plugin.toolName === toolName);
}

export function loadingLabelForLiteratureAction(action?: string, userMessage?: string): string | null {
  const lower = (userMessage ?? "").toLowerCase();

  if (/\b10\.\d{4,9}\//.test(userMessage ?? "") || lower.includes("doi")) {
    return getClientPluginMetaByToolName("cite_from_doi")?.loadingLabel ?? null;
  }

  if (lower.includes("arxiv")) {
    return getClientPluginMetaByToolName("search_arxiv")?.loadingLabel ?? null;
  }

  if (lower.includes("github") && (lower.includes("import") || lower.includes("repo"))) {
    return getClientPluginMetaByToolName("parse_github_repo")?.loadingLabel ?? null;
  }

  if (action === "find-papers" || action === "citation") {
    return getClientPluginMetaByToolName("search_literature")?.loadingLabel ?? null;
  }

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

export function loadingLabelForForcedTool(toolName?: string): string | null {
  if (!toolName) return null;
  const meta = getClientPluginMetaByToolName(toolName);
  if (meta) return meta.loadingLabel;

  switch (toolName) {
    case "list_files":
      return "Listing project files…";
    case "get_file":
      return "Reading file…";
    default:
      return null;
  }
}

export function loadingLabelForAction(
  action?: string,
  userMessage?: string,
  forcedTool?: string
): string {
  const forced = loadingLabelForForcedTool(forcedTool);
  if (forced) return forced;

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
