import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { db } from "./db";
import * as schema from "./schema";
import { config } from "./config";
import { getGithubAuthConfig, getGoogleAuthConfig, getOrcidAuthConfig } from "./auth-providers";
import { buildGithubSocialProviderOptions } from "./github-auth-provider";
import { buildOrcidGenericOAuthConfig } from "./orcid-auth-provider";
import {
  getBrandTrustedOrigins,
  getSelfHostedTrustedOrigins,
  getServerAppUrl,
} from "./urls";
import { sendPlicumEmail } from "./email/send";
import { renderResetPasswordEmail } from "./email/templates";
import { PRODUCT_NAME } from "./product";
import { eq, count } from "drizzle-orm";

const googleAuth = getGoogleAuthConfig();
const githubAuth = getGithubAuthConfig();
const orcidAuth = getOrcidAuthConfig();

const socialProviders = {
  ...(googleAuth
    ? {
        google: {
          clientId: googleAuth.clientId,
          clientSecret: googleAuth.clientSecret,
        },
      }
    : {}),
  ...(githubAuth
    ? {
        github: buildGithubSocialProviderOptions(githubAuth),
      }
    : {}),
};

export const auth = betterAuth({
  plugins: orcidAuth
    ? [
        genericOAuth({
          config: [buildOrcidGenericOAuthConfig(orcidAuth)],
        }),
      ]
    : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
    },
  },
  socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = renderResetPasswordEmail({
        productName: PRODUCT_NAME,
        userName: user.name,
        resetUrl: url,
        appUrl: getServerAppUrl(),
      });
      void sendPlicumEmail({ to: user.email, subject, html, text });
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "user", input: false },
      plan: { type: "string", defaultValue: "free", input: false },
      stripeCustomerId: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  baseURL: config.appUrl,
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-me-in-production",
  trustedOrigins: config.isSelfHosted
    ? (request) => getSelfHostedTrustedOrigins(request)
    : [...new Set([config.appUrl, ...getBrandTrustedOrigins()])],
  advanced: config.isSelfHosted
    ? { trustedProxyHeaders: true }
    : undefined,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (config.isSelfHosted) {
            const [result] = await db.select({ count: count() }).from(schema.user);
            if (result.count === 1) {
              await db
                .update(schema.user)
                .set({ role: "admin" })
                .where(eq(schema.user.id, user.id));

              const orgExists = await db.select().from(schema.organization).limit(1);
              if (orgExists.length === 0) {
                await db.insert(schema.organization).values({
                  id: crypto.randomUUID(),
                  name: config.orgName,
                });
              }
            }
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
