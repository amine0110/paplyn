import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import type { ZoteroCredentials } from "@/lib/zotero";

export interface UserZoteroSettings {
  zoteroUserId: string | null;
  hasZoteroKey: boolean;
  zoteroApiKeyLast4: string | null;
}

export async function getUserZoteroSettings(userId: string): Promise<UserZoteroSettings> {
  const [row] = await db
    .select({
      zoteroUserId: user.zoteroUserId,
      zoteroApiKey: user.zoteroApiKey,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const apiKey = row?.zoteroApiKey ?? null;
  return {
    zoteroUserId: row?.zoteroUserId ?? null,
    hasZoteroKey: Boolean(apiKey),
    zoteroApiKeyLast4: apiKey && apiKey.length >= 4 ? apiKey.slice(-4) : null,
  };
}

export async function getUserZoteroCredentials(userId: string): Promise<ZoteroCredentials | null> {
  const [row] = await db
    .select({
      zoteroUserId: user.zoteroUserId,
      zoteroApiKey: user.zoteroApiKey,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  const userIdValue = row?.zoteroUserId?.trim();
  const apiKey = row?.zoteroApiKey?.trim();
  if (!userIdValue || !apiKey) return null;

  return { userId: userIdValue, apiKey };
}

export async function updateUserZoteroSettings(
  userId: string,
  input: { zoteroUserId?: string; zoteroApiKey?: string; clearZoteroApiKey?: boolean }
): Promise<UserZoteroSettings> {
  const updates: {
    zoteroUserId?: string | null;
    zoteroApiKey?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.zoteroUserId !== undefined) {
    const trimmed = input.zoteroUserId.trim();
    updates.zoteroUserId = trimmed || null;
  }

  if (input.clearZoteroApiKey) {
    updates.zoteroApiKey = null;
  } else if (input.zoteroApiKey !== undefined) {
    const trimmed = input.zoteroApiKey.trim();
    updates.zoteroApiKey = trimmed || null;
  }

  await db.update(user).set(updates).where(eq(user.id, userId));
  return getUserZoteroSettings(userId);
}
