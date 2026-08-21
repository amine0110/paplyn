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
  process.env.NEXT_PUBLIC_PRODUCT_NAME || process.env.PRODUCT_NAME || "Plicum";

/** Internal npm / Docker scope. Not shown in the UI. */
export const PACKAGE_SCOPE = "quire";

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
  landingLead: `is a modern LaTeX workspace for researchers and students. Real-time collaboration, instant PDF preview, and AI assistance — hosted or self-hosted.`,

  /** SaaS offering label on landing */
  get hostedEditionName() {
    return `${PRODUCT_NAME} Cloud`;
  },

  get selfHostBlurb() {
    return `Run ${PRODUCT_NAME} on your own infrastructure with Docker Compose. Single organization, no billing, full control.`;
  },

  get footerLine() {
    return `${PRODUCT_NAME} — ${TAGLINE}. MIT License.`;
  },

  get signInHeading() {
    return `Sign in to ${PRODUCT_NAME}`;
  },

  get adminSubtitle() {
    return `Configure your self-hosted ${PRODUCT_NAME} instance.`;
  },

  get appearanceNote() {
    return `${PRODUCT_NAME} uses a calm, paper-white theme optimized for long writing sessions. Dark mode coming in a future release.`;
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
