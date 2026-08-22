export type AiProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export const XAI_DEFAULT_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = "grok-4.6";
export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export type AiEnv = {
  xaiApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel?: string;
};

export type OrgAiSettings = {
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  openaiModel?: string | null;
};

export function isOpenAiHostedBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "api.openai.com" || host.endsWith(".api.openai.com");
  } catch {
    return baseUrl.includes("api.openai.com");
  }
}

/** Hosted (SaaS): XAI_API_KEY + xAI defaults, else OPENAI_* BYO. */
export function resolveHostedAiConfig(env: AiEnv): AiProviderConfig | null {
  const xaiKey = env.xaiApiKey?.trim();
  if (xaiKey) {
    return {
      apiKey: xaiKey,
      baseUrl: XAI_DEFAULT_BASE_URL,
      model: env.openaiModel?.trim() || XAI_DEFAULT_MODEL,
    };
  }

  const openaiKey = env.openaiApiKey?.trim();
  if (openaiKey) {
    const baseUrl = env.openaiBaseUrl?.trim() || OPENAI_DEFAULT_BASE_URL;
    return {
      apiKey: openaiKey,
      baseUrl,
      model: env.openaiModel?.trim() || OPENAI_DEFAULT_MODEL,
    };
  }

  return null;
}

/** Self-hosted: org BYO settings first, then OPENAI_* env (unchanged). */
export function resolveSelfHostedAiConfig(
  org: OrgAiSettings | null | undefined,
  env: AiEnv & {
    fallbackOpenaiBaseUrl?: string;
    fallbackOpenaiModel?: string;
  }
): AiProviderConfig | null {
  const orgKey = org?.openaiApiKey?.trim();
  if (orgKey) {
    return {
      apiKey: orgKey,
      baseUrl:
        org.openaiBaseUrl?.trim() ||
        env.openaiBaseUrl?.trim() ||
        env.fallbackOpenaiBaseUrl ||
        OPENAI_DEFAULT_BASE_URL,
      model:
        org.openaiModel?.trim() ||
        env.openaiModel?.trim() ||
        env.fallbackOpenaiModel ||
        OPENAI_DEFAULT_MODEL,
    };
  }

  const openaiKey = env.openaiApiKey?.trim();
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseUrl: env.openaiBaseUrl?.trim() || OPENAI_DEFAULT_BASE_URL,
      model: env.openaiModel?.trim() || OPENAI_DEFAULT_MODEL,
    };
  }

  return null;
}

export function aiNotConfiguredMessage(isSelfHosted: boolean): string {
  if (isSelfHosted) {
    return "AI not configured. Set an API key in Admin settings or OPENAI_API_KEY in environment.";
  }
  return "AI not configured. Set XAI_API_KEY for hosted Grok, or OPENAI_API_KEY with OPENAI_BASE_URL for BYO OpenAI.";
}

/** Client-safe: reads only NEXT_PUBLIC_DEPLOYMENT_MODE (defaults to selfhosted). */
export function isClientSelfHosted(): boolean {
  return (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE || "selfhosted") !== "saas";
}

export function aiUnavailableBannerMessage(isSelfHosted: boolean): string {
  if (isSelfHosted) {
    return "Configure an API key in Admin settings or OPENAI_API_KEY to enable AI features.";
  }
  return "AI assistant is not available. Hosted deployments need XAI_API_KEY (Grok) or OPENAI_API_KEY.";
}

export function readAiEnvFromProcess(env: NodeJS.ProcessEnv = process.env): AiEnv {
  return {
    xaiApiKey: env.XAI_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL,
    openaiModel: env.OPENAI_MODEL,
  };
}
