import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/lib/schema";

export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

export async function requireAuth(): Promise<{ user: User; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return { user: session.user as User, session };
}

export async function requireAdmin(): Promise<{ user: User }> {
  const { user } = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return { user };
}

export type RequireAdminApiResult =
  | { authorized: true; user: User }
  | { authorized: false; status: number; error: string };

/** Pure admin guard for API routes (testable without Next request context). */
export function evaluateRequireAdmin(
  session: Awaited<ReturnType<typeof getSession>>
): RequireAdminApiResult {
  if (!session?.user) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }
  const currentUser = session.user as User;
  if (currentUser.role !== "admin") {
    return { authorized: false, status: 403, error: "Forbidden" };
  }
  return { authorized: true, user: currentUser };
}

/** API-friendly admin guard (JSON errors instead of redirects). */
export async function requireAdminApi(): Promise<RequireAdminApiResult> {
  return evaluateRequireAdmin(await getSession());
}
