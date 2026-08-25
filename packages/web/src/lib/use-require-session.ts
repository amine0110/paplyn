"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { leaveForLogin } from "@/lib/auth-redirect";

type UseRequireSessionOptions = {
  /** When set, unauthenticated users are sent to /login?next=… */
  loginNext?: string;
};

/**
 * Redirects away when the session is missing. Uses a hard navigation so stale
 * client state cannot keep rendering private UI after sign-out.
 */
export function useRequireSession(options?: UseRequireSessionOptions) {
  const { data: session, isPending } = useSession();
  const isAuthenticated = !!session?.user;

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      leaveForLogin(options?.loginNext);
    }
  }, [isPending, isAuthenticated, options?.loginNext]);

  return { session, isPending, isAuthenticated };
}
