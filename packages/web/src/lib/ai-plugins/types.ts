import type { Tool } from "ai";
import type { PluginLanding } from "@/lib/integrations/types";

/** Server-side AI capability plugin (literature search, web search, Zotero, etc.). */
export interface AiPlugin {
  id: string;
  name: string;
  description: string;
  /** Tool key exposed to generateText. */
  toolName: string;
  enabled: boolean;
  /** Build the Vercel AI SDK tool for this plugin. */
  createTool: () => Tool;
  /** Optional system-prompt guidance when the plugin is enabled. */
  systemPrompt?: string;
  /** Extra prompt text keyed by chat action (e.g. find-papers). */
  actionPrompts?: Record<string, string>;
  /** Landing-page "Works with" metadata (same registry as in-app tools). */
  landing?: PluginLanding;
}

export interface ResolvedAiPlugins {
  plugins: AiPlugin[];
  tools: Record<string, Tool>;
  systemPrompt: string;
}
