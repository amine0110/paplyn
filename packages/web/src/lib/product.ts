/**
 * Product branding — single source of truth for public name, tagline, and metadata.
 *
 * Optional env override: PRODUCT_NAME or NEXT_PUBLIC_PRODUCT_NAME (runtime / client).
 *
 * Keep in sync when changing the public name:
 * - LICENSE copyright line → PRODUCT.copyrightHolder
 * - README heading (developer docs; references this file)
 *
 * Internal npm / Docker scope stays PACKAGE_SCOPE (not user-facing).
 */

export const PRODUCT_NAME =
  process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "Paplyn";

/** Canonical public hostname (SaaS). */
export const PUBLIC_SITE_HOST = "paplyn.com";

/** Canonical public site URL for links, user-agent strings, and email fallbacks. */
export const PUBLIC_SITE_URL = `https://${PUBLIC_SITE_HOST}`;

/**
 * Origins accepted during the Paplyn brand cutover (canonical + legacy plicum.com).
 * Used by Better Auth trustedOrigins so existing sessions survive the domain switch.
 */
export const BRAND_TRUSTED_ORIGINS = [
  PUBLIC_SITE_URL,
  `https://www.${PUBLIC_SITE_HOST}`,
  "https://plicum.com",
  "https://www.plicum.com",
] as const;

/** Internal npm / Docker scope. Not shown in the UI. */
export const PACKAGE_SCOPE = "paplyn";

/** Open-source repository for self-hosting instructions and source. */
export const GITHUB_REPO_URL = "https://github.com/amine0110/paplyn";

const TAGLINE = "Collaborative LaTeX";

const SHORT_DESCRIPTION =
  "Modern LaTeX workspace for researchers and students. Write, compile, and collaborate.";

export const PRODUCT = {
  get name() {
    return PRODUCT_NAME;
  },

  tagline: TAGLINE,

  shortDescription: SHORT_DESCRIPTION,

  /** Browser tab + Open Graph title */
  get pageTitle() {
    return `${PRODUCT_NAME} — ${TAGLINE}`;
  },

  /** Open Graph / meta description */
  metaDescription: SHORT_DESCRIPTION,

  /** Landing hero */
  headline: "Write research.",
  headlineLine2: "Compile with confidence.",

  /** Sentence fragment after product name: "{name} is a modern LaTeX workspace..." */
  landingLead: `is an open-source LaTeX workspace for researchers and students. Real-time collaboration, instant PDF preview, and AI assistance — deploy your own instance with Docker.`,

  /** Shown when PUBLIC_SIGNUPS_ENABLED=false on a private deployment */
  privateInstanceMessage:
    "This instance is private. Deploy your own Paplyn from the open-source repository on GitHub.",

  /** Multi-tenant mode label on landing (for operators, not a public cloud signup) */
  get multiTenantEditionName() {
    return "Multi-tenant (SaaS mode)";
  },

  get selfHostBlurb() {
    return `Run ${PRODUCT_NAME} on your own infrastructure with Docker Compose. Single organization, no billing, full control.`;
  },

  get footerLine() {
    return `${PRODUCT_NAME} — ${TAGLINE}.`;
  },

  get signInHeading() {
    return `Sign in to ${PRODUCT_NAME}`;
  },

  get adminSubtitle() {
    return `Configure your self-hosted ${PRODUCT_NAME} instance.`;
  },

  get appearanceNote() {
    return `${PRODUCT_NAME} uses a calm, paper-inspired theme with light and dark modes for long writing sessions.`;
  },

  /** AI system prompt persona name */
  get aiAssistantName() {
    return `${PRODUCT_NAME} AI`;
  },

  /** MIT license / legal copyright holder */
  get copyrightHolder() {
    return PRODUCT_NAME;
  },

  /** Example addresses in UI copy (not real mailboxes) */
  emails: {
    invitePlaceholder: "colleague@university.edu",
    example: "email@example.com",
  },
} as const;
