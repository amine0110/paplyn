import { desc, eq, ilike, or, count } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import {
  compileLog,
  projectInvite,
  projectRevision,
  user,
  type User,
} from "./schema";
import { toUtcIsoString } from "./format-date";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
};

export function serializeAdminUser(
  row: Pick<User, "id" | "email" | "name" | "role" | "createdAt">
): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isAdmin: row.role === "admin",
    createdAt: toUtcIsoString(row.createdAt),
  };
}

export async function hasInstanceAdmin(): Promise<boolean> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, "admin"))
    .limit(1);
  return !!row;
}

/** Admin panel is available in self-hosted mode or when an instance admin exists (SaaS). */
export async function isAdminPanelAvailable(): Promise<boolean> {
  if (config.isSelfHosted) return true;
  return await hasInstanceAdmin();
}

export async function listUsersForAdmin(search?: string): Promise<AdminUserSummary[]> {
  const trimmed = search?.trim();
  const rows = trimmed
    ? await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(or(ilike(user.email, `%${trimmed}%`), ilike(user.name, `%${trimmed}%`)))
        .orderBy(desc(user.createdAt))
    : await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(desc(user.createdAt));

  return rows.map(serializeAdminUser);
}

export type DeleteUserForAdminResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function deleteUserForAdmin(
  targetUserId: string,
  actorUserId: string
): Promise<DeleteUserForAdminResult> {
  if (targetUserId === actorUserId) {
    return { ok: false, status: 400, error: "You cannot remove your own account." };
  }

  const [target] = await db
    .select({
      id: user.id,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, status: 404, error: "User not found" };
  }

  if (target.role === "admin") {
    const [adminCount] = await db
      .select({ count: count() })
      .from(user)
      .where(eq(user.role, "admin"));

    if (adminCount.count <= 1) {
      return {
        ok: false,
        status: 400,
        error: "Cannot remove the last admin on this instance.",
      };
    }
  }

  await db.delete(projectInvite).where(eq(projectInvite.invitedBy, targetUserId));
  await db.delete(compileLog).where(eq(compileLog.userId, targetUserId));
  await db.delete(projectRevision).where(eq(projectRevision.userId, targetUserId));
  await db.delete(user).where(eq(user.id, targetUserId));

  return { ok: true };
}
