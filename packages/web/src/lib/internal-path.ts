/** True for same-origin app paths like `/dashboard`, not protocol-relative `//evil`. */
export function isInternalAppPath(path: string | undefined | null): boolean {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

export function resolveInternalNextPath(
  path: string | undefined | null,
  fallback = "/dashboard",
): string {
  return isInternalAppPath(path) ? path : fallback;
}
