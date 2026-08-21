import { getServerAppUrl } from "./urls";

export type DeploymentMode = "saas" | "selfhosted";

export const config = {
  deploymentMode: (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE || "selfhosted") as DeploymentMode,
  isSaas: (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE) === "saas",
  isSelfHosted: (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE || "selfhosted") !== "saas",

  /** Server-side canonical URL — prefers runtime BETTER_AUTH_URL over build-time NEXT_PUBLIC. */
  get appUrl() {
    return getServerAppUrl();
  },
  /** @deprecated Prefer resolveCollabUrl(request) for request-aware resolution. */
  get collabUrl() {
    return process.env.COLLAB_URL || process.env.NEXT_PUBLIC_COLLAB_URL || "ws://localhost:1234";
  },
  compilerUrl: process.env.COMPILER_URL || "http://localhost:3001",
  collabSecret: process.env.COLLAB_SECRET || "dev-collab-secret",

  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    prices: {
      student: process.env.STRIPE_PRICE_STUDENT || "",
      researcher: process.env.STRIPE_PRICE_RESEARCHER || "",
    },
  },

  orgName: process.env.ORG_NAME || "My Organization",
  compileTimeoutMs: parseInt(process.env.COMPILE_TIMEOUT_MS || "60000", 10),
};

export const PLAN_LIMITS = {
  free: { projects: 3, compilesPerMonth: 50, aiRequestsPerMonth: 20 },
  student: { projects: 10, compilesPerMonth: 500, aiRequestsPerMonth: 200 },
  researcher: { projects: 50, compilesPerMonth: 5000, aiRequestsPerMonth: 2000 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
