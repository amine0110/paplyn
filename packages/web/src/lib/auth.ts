import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./schema";
import { config } from "./config";
import { getSelfHostedTrustedOrigins } from "./urls";
import { eq, count } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
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
    : [config.appUrl],
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
