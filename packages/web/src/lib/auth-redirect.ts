import { signOut } from "@/lib/auth-client";

/** Hard navigation so client state cannot linger after sign-out. */
export async function signOutAndLeave(): Promise<void> {
  await signOut();
  leaveForHome();
}

export function leaveForHome(): void {
  window.location.assign("/");
}

export function leaveForLogin(next?: string): void {
  const path = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  window.location.assign(path);
}
