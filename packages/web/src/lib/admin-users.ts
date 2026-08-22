import { desc, eq, ilike, or } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { user, type User } from "./schema";
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
