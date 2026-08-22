/** Shared landing-page integration entry (plugins, AI provider, core stack). */
export type IntegrationCategory = "core" | "ai" | "plugin";

export interface LandingIntegration {
  id: string;
  name: string;
  category: IntegrationCategory;
  href?: string;
  /** Text wordmark — no raster or unofficial brand SVGs. */
  wordmark: string;
  wordmarkClassName?: string;
  caption?: string;
}

/** Optional landing metadata on an AI plugin (name/id come from the plugin). */
export interface PluginLanding {
  href?: string;
  wordmark?: string;
  wordmarkClassName?: string;
  caption?: string;
}
