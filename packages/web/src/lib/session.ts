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
