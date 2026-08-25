/** App routes that require a signed-in session before any page UI is rendered. */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/settings",
  "/admin",
  "/project",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function loginRedirectUrl(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}
