import { generateObject, type LanguageModel, type Tool } from "ai";
import { z } from "zod";
import {
  isPluginToolName,
  PLUGIN_TOOL_NAMES,
  type PluginToolName,
} from "@/lib/ai-plugins/forced-tool";
import type { AiPlugin } from "@/lib/ai-plugins/types";
import {
  CLIENT_ACTION_TOOL_NAMES,
  WORKSPACE_READ_TOOL_NAMES,
  WORKSPACE_TOOL_NAMES,
} from "@/lib/ai-plugins/workspace-tools";
import { classifyCompileDiagnosticsReviewFallback } from "@/lib/ai-compile-diagnostics-intent";

export const aiIntentSchema = z.enum([
  "chat",
  "edit",
  "literature",
  "cite",
  "library",
  "import",
]);

export type AiIntent = z.infer<typeof aiIntentSchema>;

const intentClassificationSchema = z.object({
  intent: aiIntentSchema,
});

const FORCED_TOOL_INTENT: Record<PluginToolName, AiIntent> = {
  search_zotero: "library",
  search_literature: "literature",
  search_arxiv: "literature",
  cite_from_doi: "cite",
  parse_github_repo: "import",
};

const PLUGIN_TOOLS_BY_INTENT: Record<AiIntent, readonly PluginToolName[]> = {
  chat: [],
  edit: [],
  literature: ["search_literature", "search_arxiv"],
  cite: ["cite_from_doi"],
  library: ["search_zotero"],
  import: ["parse_github_repo"],
};

const ACTION_INTENT: Partial<Record<string, AiIntent>> = {
  "find-papers": "literature",
  citation: "cite",
  tighten: "edit",
  rephrase: "edit",
  improve: "edit",
  shorten: "edit",
  expand: "edit",
  correct: "edit",
  write: "edit",
};

const EDIT_FALLBACK_PATTERNS: RegExp[] = [
  /\brewrite\b/i,
  /\brephrase\b/i,
  /\bedit\b/i,
  /\bchange\b/i,
  /\bupdate\b/i,
  /\bmodify\b/i,
  /\badd\b.+\b(section|paragraph|sentence|abstract|introduction|conclusion)\b/i,
  /\b(abstract|introduction|conclusion|section|paragraph)\b.+\b(to|so that|mention|include)\b/i,
  /\bmention\b/i,
  /\binsert\b/i,
  /\breplace\b/i,
  /\bfix\b.+\b(text|wording|grammar|typo|abstract|introduction|conclusion|section|paragraph)\b/i,
  /\bimprove\b/i,
  /\btighten\b/i,
  /\bshorten\b/i,
  /\bexpand\b/i,
];

const LITERATURE_FALLBACK_PATTERNS: RegExp[] = [
  /\bfind papers?\b/i,
  /\bsearch (?:for )?(?:papers?|literature|related work)\b/i,
  /\brelated work\b/i,
  /\bliterature review\b/i,
  /\blook up papers?\b/i,
  /\barxiv\b/i,
  /\bsemantic scholar\b/i,
];

const CITE_FALLBACK_PATTERNS: RegExp[] = [
  /\bcite\b/i,
  /\bbibtex\b/i,
  /\bbibliography\b/i,
  /\bdoi\b/i,
  /\bcrossref\b/i,
  /\breference\b/i,
];

const LIBRARY_FALLBACK_PATTERNS: RegExp[] = [
  /\bzotero\b/i,
  /\bmy library\b/i,
  /\bsearch my (?:zotero|library)\b/i,
];

const IMPORT_FALLBACK_PATTERNS: RegExp[] = [
  /\bgithub\b/i,
  /\bimport (?:a |the )?repo\b/i,
  /\bparse_github_repo\b/i,
];

const CHAT_FALLBACK_PATTERNS: RegExp[] = [
  /\bwhat (?:is|does|are)\b/i,
  /\bexplain\b/i,
  /\bsummarize\b/i,
  /\bsummary\b/i,
  /\bwhat(?:'s| is) (?:section|chapter)\b/i,
  /\bsaying\b/i,
  /\bmean\b/i,
  /\?\s*$/,
];

export function intentFromForcedTool(forcedTool: string | undefined): AiIntent | undefined {
  if (!forcedTool || !isPluginToolName(forcedTool)) return undefined;
  return FORCED_TOOL_INTENT[forcedTool];
}

export function intentFromAction(action: string | undefined): AiIntent | undefined {
  if (!action || action === "chat" || action === "explain-errors") return undefined;
  return ACTION_INTENT[action];
}

export function pluginToolNamesForIntent(intent: AiIntent): readonly PluginToolName[] {
  return PLUGIN_TOOLS_BY_INTENT[intent];
}

export function mountedPluginToolNames(options: {
  intent: AiIntent;
  forcedToolName?: PluginToolName;
  compileFix: boolean;
}): readonly PluginToolName[] {
  if (options.compileFix) return [];
  if (options.forcedToolName) return [options.forcedToolName];
  return pluginToolNamesForIntent(options.intent);
}

export function workspaceToolNamesForIntent(
  intent: AiIntent,
  options?: { includeCompileDiagnostics?: boolean }
): readonly string[] {
  if (intent === "chat") {
    return options?.includeCompileDiagnostics
      ? WORKSPACE_READ_TOOL_NAMES
      : ["list_files", "get_file"];
  }
  return options?.includeCompileDiagnostics
    ? WORKSPACE_TOOL_NAMES
    : WORKSPACE_TOOL_NAMES.filter((name) => name !== "get_compile_diagnostics");
}

export function pluginSystemPromptForMountedTools(
  mountedToolNames: readonly PluginToolName[],
  plugins: AiPlugin[]
): string {
  const mounted = new Set(mountedToolNames);
  return plugins
    .filter((plugin) => mounted.has(plugin.toolName as PluginToolName))
    .map((plugin) => plugin.systemPrompt?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function pluginSystemPromptForIntent(intent: AiIntent, plugins: AiPlugin[]): string {
  return pluginSystemPromptForMountedTools(pluginToolNamesForIntent(intent), plugins);
}

export function pluginActionPromptForMountedTools(
  mountedToolNames: readonly PluginToolName[],
  action: string,
  plugins: AiPlugin[]
): string | undefined {
  const mounted = new Set(mountedToolNames);
  for (const plugin of plugins) {
    if (!mounted.has(plugin.toolName as PluginToolName)) continue;
    const prompt = plugin.actionPrompts?.[action]?.trim();
    if (prompt) return prompt;
  }
  return undefined;
}

export function pickToolsByName<T extends Tool>(
  tools: Record<string, T>,
  names: readonly string[]
): Record<string, T> {
  const picked: Record<string, T> = {};
  for (const name of names) {
    if (name in tools) {
      picked[name] = tools[name]!;
    }
  }
  return picked;
}

export function toolsForIntent(
  intent: AiIntent,
  pluginTools: Record<string, Tool>,
  workspaceTools: Record<string, Tool>,
  options?: { includeCompileDiagnostics?: boolean }
): Record<string, Tool> {
  const pluginSubset = pickToolsByName(pluginTools, pluginToolNamesForIntent(intent));
  const workspaceSubset = pickToolsByName(
    workspaceTools,
    workspaceToolNamesForIntent(intent, options)
  );
  return { ...pluginSubset, ...workspaceSubset };
}

export function toolsForForcedPlugin(
  forcedToolName: PluginToolName,
  pluginTools: Record<string, Tool>,
  workspaceTools: Record<string, Tool>
): Record<string, Tool> {
  const forcedTool = pluginTools[forcedToolName];
  if (!forcedTool) return { ...workspaceTools };
  return { [forcedToolName]: forcedTool, ...workspaceTools };
}

export function getAllowedPluginToolNames(options: {
  intent: AiIntent;
  forcedToolName?: PluginToolName;
  compileFix: boolean;
}): Set<PluginToolName> {
  return new Set(mountedPluginToolNames(options));
}

const DISALLOWED_PLUGIN_TOOL_MESSAGE =
  "This integration is not available for the current request. Ask again with the tool picker (+) if you need it.";

export function wrapPluginToolsWithPolicy(
  tools: Record<string, Tool>,
  allowedPluginTools: ReadonlySet<string>
): Record<string, Tool> {
  const wrapped: Record<string, Tool> = {};

  for (const [name, pluginTool] of Object.entries(tools)) {
    if (!(PLUGIN_TOOL_NAMES as readonly string[]).includes(name)) {
      wrapped[name] = pluginTool;
      continue;
    }

    const originalExecute = pluginTool.execute;
    if (!originalExecute) {
      wrapped[name] = pluginTool;
      continue;
    }

    wrapped[name] = {
      ...pluginTool,
      execute: async (args, options) => {
        if (!allowedPluginTools.has(name)) {
          return {
            kind: "plugin-tool-blocked" as const,
            toolName: name,
            error: DISALLOWED_PLUGIN_TOOL_MESSAGE,
          };
        }
        return originalExecute(args, options);
      },
    };
  }

  return wrapped;
}

export function classifyAiIntentFallback(options: {
  message: string;
  forcedTool?: string;
  action?: string;
  compileFix?: boolean;
  compileDiagnostics?: boolean;
}): AiIntent {
  const { message, forcedTool, action, compileFix, compileDiagnostics } = options;

  if (compileFix || compileDiagnostics) return "edit";

  const fromForced = intentFromForcedTool(forcedTool);
  if (fromForced) return fromForced;

  const fromAction = intentFromAction(action);
  if (fromAction) return fromAction;

  const trimmed = message.trim();
  if (!trimmed) return "chat";

  if (LIBRARY_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "library";
  }

  if (LITERATURE_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "literature";
  }

  if (CITE_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "cite";
  }

  if (IMPORT_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "import";
  }

  if (classifyCompileDiagnosticsReviewFallback(trimmed)) {
    return "edit";
  }

  if (EDIT_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "edit";
  }

  if (CHAT_FALLBACK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "chat";
  }

  return "chat";
}

export async function classifyAiIntent(options: {
  message: string;
  forcedTool?: string;
  action?: string;
  compileFix?: boolean;
  compileDiagnostics?: boolean;
  model?: LanguageModel;
}): Promise<AiIntent> {
  const { message, forcedTool, action, compileFix, compileDiagnostics, model } = options;

  if (compileFix || compileDiagnostics) return "edit";

  const fromForced = intentFromForcedTool(forcedTool);
  if (fromForced) return fromForced;

  const fromAction = intentFromAction(action);
  if (fromAction) return fromAction;

  if (!model) {
    return classifyAiIntentFallback({ message, forcedTool, action, compileFix, compileDiagnostics });
  }

  try {
    const { object } = await generateObject({
      model,
      schema: intentClassificationSchema,
      maxRetries: 0,
      prompt: `Classify the user's message for a LaTeX writing assistant.

Choose exactly one intent:
- chat: questions, explanations, summaries — read project files only, no edits or external search.
- edit: rewrite, fix wording, or change manuscript content.
- literature: find academic papers or related work (not the user's personal library).
- cite: resolve a DOI or build a BibTeX citation.
- library: search the user's personal Zotero library (only when they clearly mean Zotero or "my library").
- import: import or inspect a GitHub repository.

Never choose library unless the user explicitly asks about Zotero or their personal library.

User message:
${message.trim()}`,
    });

    return object.intent;
  } catch {
    return classifyAiIntentFallback({ message, forcedTool, action, compileFix, compileDiagnostics });
  }
}

export const AI_INTENT_WORKSPACE_EDIT_TOOL_NAMES = CLIENT_ACTION_TOOL_NAMES;
