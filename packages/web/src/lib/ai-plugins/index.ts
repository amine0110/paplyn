import { semanticScholarPlugin } from "./semantic-scholar";
import type { AiPlugin, ResolvedAiPlugins } from "./types";

/** Register new plugins here — one file per capability. */
const ALL_PLUGINS: AiPlugin[] = [semanticScholarPlugin];

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

export type { AiPlugin, ResolvedAiPlugins } from "./types";
