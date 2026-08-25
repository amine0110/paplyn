import { arxivPlugin } from "./arxiv";
import { citeDoiPlugin } from "./cite-doi";
import { githubImportPlugin } from "./github-import";
import { semanticScholarPlugin } from "./semantic-scholar";
import type { AiPlugin, ResolvedAiPlugins } from "./types";

/** Register new plugins here — one file per capability. */
const ALL_PLUGINS: AiPlugin[] = [
  semanticScholarPlugin,
  citeDoiPlugin,
  arxivPlugin,
  githubImportPlugin,
];

export function listAiPlugins(): AiPlugin[] {
  return [...ALL_PLUGINS];
}

export function getEnabledAiPlugins(): AiPlugin[] {
  return ALL_PLUGINS.filter((plugin) => plugin.enabled);
}

export function resolveAiPlugins(): ResolvedAiPlugins {
  const plugins = getEnabledAiPlugins();
  const tools: Record<string, ReturnType<AiPlugin["createTool"]>> = {};

  for (const plugin of plugins) {
    tools[plugin.toolName] = plugin.createTool();
  }

  const systemPrompt = plugins
    .map((plugin) => plugin.systemPrompt?.trim())
    .filter(Boolean)
    .join("\n\n");

  return { plugins, tools, systemPrompt };
}

export function getPluginActionPrompt(action: string): string | undefined {
  for (const plugin of getEnabledAiPlugins()) {
    const prompt = plugin.actionPrompts?.[action]?.trim();
    if (prompt) return prompt;
  }
  return undefined;
}

export function getPluginByToolName(toolName: string): AiPlugin | undefined {
  return getEnabledAiPlugins().find((plugin) => plugin.toolName === toolName);
}

export function getForcedToolPrompt(toolName: string): string | undefined {
  const plugin = getPluginByToolName(toolName);
  if (!plugin) return undefined;

  return `The user manually selected the ${plugin.name} tool for this message. You MUST call ${plugin.toolName} with arguments derived from the user's message. Do not skip the tool call or substitute a different tool.`;
}

export function isRegisteredPluginToolName(toolName: string): boolean {
  return getEnabledAiPlugins().some((plugin) => plugin.toolName === toolName);
}

export function pluginDisplayName(
  plugin: AiPlugin,
  options?: { source?: string }
): string {
  if (plugin.id === "semantic-scholar" && options?.source === "openalex") {
    return "OpenAlex";
  }
  if (plugin.id === "cite-doi" && options?.source === "openalex") {
    return "OpenAlex";
  }
  if (plugin.id === "cite-doi" && options?.source === "crossref") {
    return "Crossref";
  }
  return plugin.name;
}

export type { AiPlugin, ResolvedAiPlugins } from "./types";
