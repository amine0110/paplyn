import { headers } from "next/headers";
import { requireAuth } from "@/lib/session";

/** Server layout helper: validates session and preserves the requested path for login redirects. */
export async function requireAuthLayout(fallbackPath: string) {
  const requestHeaders = await headers();
  const nextPath = requestHeaders.get("x-pathname") || fallbackPath;
  await requireAuth(nextPath);
}
