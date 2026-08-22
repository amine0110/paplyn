import { getEnabledAiPlugins } from "@/lib/ai-plugins";
import type { AiPlugin } from "@/lib/ai-plugins/types";
import { resolveAiProviderLanding } from "@/lib/ai-config";
import type { LandingIntegration } from "./types";

export type { IntegrationCategory, LandingIntegration, PluginLanding } from "./types";

const LATEX_CORE_INTEGRATION: LandingIntegration = {
  id: "latex",
  name: "LaTeX",
  category: "core",
  href: "https://www.latex-project.org/",
  wordmark: "LaTeX",
  wordmarkClassName: "font-serif text-lg font-semibold tracking-tight",
  caption: "Built-in editor & compile",
};

function pluginToLanding(plugin: AiPlugin): LandingIntegration | null {
  if (!plugin.landing) return null;
  return {
    id: plugin.id,
    name: plugin.name,
    category: "plugin",
    href: plugin.landing.href,
    wordmark: plugin.landing.wordmark ?? plugin.name,
    wordmarkClassName: plugin.landing.wordmarkClassName,
    caption: plugin.landing.caption,
  };
}

/**
 * Integrations shown on the public landing page.
 * Plugins come from the AI plugin registry; AI provider and core stack are added here.
 */
export function getLandingIntegrations(options: { isSelfHosted: boolean }): LandingIntegration[] {
  const items: LandingIntegration[] = [LATEX_CORE_INTEGRATION];

  const aiProvider = resolveAiProviderLanding({ isSelfHosted: options.isSelfHosted });
  if (aiProvider) items.push(aiProvider);

  for (const plugin of getEnabledAiPlugins()) {
    const landing = pluginToLanding(plugin);
    if (landing) items.push(landing);
  }

  return items;
}
