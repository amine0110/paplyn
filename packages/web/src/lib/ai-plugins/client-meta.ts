import { detectFixCompileIntent } from "@/lib/ai-compile-fix-intent";
import { getEnabledAiPlugins } from "./index";

export interface AiPluginClientMeta {
  id: string;
  name: string;
  /** Short label in the composer tool menu. */
  menuLabel: string;
  toolName: string;
  /** Shown while the plugin tool is running. */
  loadingLabel: string;
  /** Composer placeholder when this tool is attached to the next send. */
  inputPlaceholder?: string;
}

export const AI_PLUGIN_CLIENT_META: AiPluginClientMeta[] = [
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    menuLabel: "Semantic Scholar",
    toolName: "search_literature",
    loadingLabel: "Searching Semantic Scholar…",
    inputPlaceholder: "Paper search query…",
  },
  {
    id: "cite-doi",
    name: "Crossref",
    menuLabel: "Cite DOI / Crossref",
    toolName: "cite_from_doi",
    loadingLabel: "Resolving DOI…",
    inputPlaceholder: "Paste a DOI (10.xxxx/…)…",
  },
  {
    id: "arxiv",
    name: "arXiv",
    menuLabel: "arXiv",
    toolName: "search_arxiv",
    loadingLabel: "Searching arXiv…",
    inputPlaceholder: "arXiv query or ID…",
  },
  {
    id: "zotero",
    name: "Zotero",
    menuLabel: "Zotero",
    toolName: "search_zotero",
    loadingLabel: "Searching Zotero…",
    inputPlaceholder: "Search your Zotero library…",
  },
  {
    id: "github-import",
    name: "GitHub",
    menuLabel: "GitHub",
    toolName: "parse_github_repo",
    loadingLabel: "Checking GitHub repo…",
    inputPlaceholder: "owner/repo or GitHub URL…",
  },
];

/** Registered plugin tools shown in the composer + menu (enabled registry only). */
export function listComposerToolMeta(): AiPluginClientMeta[] {
  const enabledIds = new Set(getEnabledAiPlugins().map((plugin) => plugin.id));
  return AI_PLUGIN_CLIENT_META.filter((meta) => enabledIds.has(meta.id));
}

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

  if (lower.includes("zotero")) {
    return getClientPluginMetaByToolName("search_zotero")?.loadingLabel ?? null;
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

export function loadingLabelForAction(
  action?: string,
  userMessage?: string,
  forcedToolName?: string
): string {
  if (forcedToolName) {
    const forced = getClientPluginMetaByToolName(forcedToolName);
    if (forced) return forced.loadingLabel;
  }

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
