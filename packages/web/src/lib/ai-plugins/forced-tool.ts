import type { Tool } from "ai";
import { arxivPlugin } from "./arxiv";
import { citeDoiPlugin } from "./cite-doi";
import { getClientPluginMetaByToolName } from "./client-meta";
import { githubImportPlugin } from "./github-import";
import { semanticScholarPlugin } from "./semantic-scholar";
import type { AiPlugin } from "./types";

const REGISTERED_PLUGINS: AiPlugin[] = [
  semanticScholarPlugin,
  citeDoiPlugin,
  arxivPlugin,
  githubImportPlugin,
];

function getPluginByToolName(toolName: string): AiPlugin | undefined {
  return REGISTERED_PLUGINS.find((plugin) => plugin.enabled && plugin.toolName === toolName);
}

/** Registered plugin tool keys — kept in sync with ALL_PLUGINS. */
export const PLUGIN_TOOL_NAMES = [
  "search_literature",
  "cite_from_doi",
  "search_arxiv",
  "parse_github_repo",
] as const;

export type PluginToolName = (typeof PLUGIN_TOOL_NAMES)[number];

const CAPABILITY_QUESTION_PATTERNS = [
  /\bwhat can (?:this|the) tool do\b/i,
  /\bhow does (?:this|the) tool work\b/i,
  /\bwhat does (?:this|the) tool do\b/i,
  /\bwhat is (?:this|the) tool\b/i,
  /\btell me about (?:this|the) tool\b/i,
  /\bwhat can you do\b/i,
  /\bhow do you work\b/i,
  /\bhelp me understand (?:this|the) tool\b/i,
  /\bwhat are you (?:able|capable) to do\b/i,
];

export function isPluginToolName(toolName: string): toolName is PluginToolName {
  return (PLUGIN_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function isForcedToolCapabilityQuestion(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return CAPABILITY_QUESTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function getForcedToolDisplayName(toolName: string): string | undefined {
  const clientMeta = getClientPluginMetaByToolName(toolName);
  if (clientMeta) return clientMeta.menuLabel;

  const plugin = getPluginByToolName(toolName);
  return plugin?.name;
}

export function getForcedToolPrompt(toolName: string): string | undefined {
  const plugin = getPluginByToolName(toolName);
  if (!plugin) return undefined;

  const displayName = getForcedToolDisplayName(toolName) ?? plugin.name;
  const capabilityHint = plugin.description.trim();
  const usageHint = plugin.systemPrompt?.trim();

  const lines = [
    `The user attached the **${displayName}** integration for this message only.`,
    `When they say "this tool", they mean **${displayName}** — not Paplyn AI workspace tools (list_files, get_file, apply_edit, replace_lines, insert_at_cursor, replace_selection, fix_compile_errors, or other integrations).`,
    `If they ask what this tool can do, how it works, or what you can do with it, describe only **${displayName}**: ${capabilityHint}`,
    usageHint
      ? `Operational guidance for ${displayName}:\n${usageHint}`
      : undefined,
    `For any other request in this message, you MUST call ${plugin.toolName} with arguments derived from the user's message. Do not skip the tool call or substitute a different tool.`,
  ];

  return lines.filter(Boolean).join("\n\n");
}

export function resolveForcedToolChoice(options: {
  forcedTool?: string;
  userMessage: string;
  pluginTools: Record<PluginToolName, Tool>;
}): PluginToolName | undefined {
  const { forcedTool, userMessage, pluginTools } = options;
  if (!forcedTool || !isPluginToolName(forcedTool)) return undefined;
  if (!(forcedTool in pluginTools)) return undefined;
  if (isForcedToolCapabilityQuestion(userMessage)) return undefined;
  return forcedTool;
}

export type PluginToolsRecord = Record<PluginToolName, Tool>;

export function asPluginToolsRecord(
  tools: Record<string, Tool>
): PluginToolsRecord | null {
  for (const name of PLUGIN_TOOL_NAMES) {
    if (!(name in tools)) return null;
  }
  return tools as PluginToolsRecord;
}
