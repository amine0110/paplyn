import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { usageCounter, user, project } from "./schema";
import { PLAN_LIMITS, type Plan, config } from "./config";
import { generateId, getCurrentMonth } from "./utils";

async function getOrCreateUsage(userId: string) {
  const month = getCurrentMonth();
  const [existing] = await db
    .select()
    .from(usageCounter)
    .where(and(eq(usageCounter.userId, userId), eq(usageCounter.month, month)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(usageCounter)
    .values({ id: generateId(), userId, month })
    .returning();

  return created;
}

export async function checkCompileLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (config.isSelfHosted) return { allowed: true };

  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return { allowed: false, reason: "User not found" };

  const plan = u.plan as Plan;
  const limits = PLAN_LIMITS[plan];
  const usage = await getOrCreateUsage(userId);

  if (usage.compiles >= limits.compilesPerMonth) {
    return { allowed: false, reason: `Monthly compile limit (${limits.compilesPerMonth}) reached` };
  }

  return { allowed: true };
}

export async function incrementCompileUsage(userId: string) {
  if (config.isSelfHosted) return;
  const usage = await getOrCreateUsage(userId);
  await db
    .update(usageCounter)
    .set({ compiles: usage.compiles + 1 })
    .where(eq(usageCounter.id, usage.id));
}

export async function checkAiLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (config.isSelfHosted) return { allowed: true };

  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return { allowed: false, reason: "User not found" };

  const plan = u.plan as Plan;
  const limits = PLAN_LIMITS[plan];
  const usage = await getOrCreateUsage(userId);

  if (usage.aiRequests >= limits.aiRequestsPerMonth) {
    return { allowed: false, reason: `Monthly AI request limit (${limits.aiRequestsPerMonth}) reached` };
  }

  return { allowed: true };
}

export async function incrementAiUsage(userId: string) {
  if (config.isSelfHosted) return;
  const usage = await getOrCreateUsage(userId);
  await db
    .update(usageCounter)
    .set({ aiRequests: usage.aiRequests + 1 })
    .where(eq(usageCounter.id, usage.id));
}

export async function checkProjectLimit(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  if (config.isSelfHosted) return { allowed: true };

  const [u] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!u) return { allowed: false, reason: "User not found" };

  const plan = u.plan as Plan;
  const limits = PLAN_LIMITS[plan];

  const owned = await db.select().from(project).where(eq(project.ownerId, userId));
  const active = owned.filter((p) => !p.archived);

  if (active.length >= limits.projects) {
    return { allowed: false, reason: `Project limit (${limits.projects}) reached for ${plan} plan` };
  }

  return { allowed: true };
}