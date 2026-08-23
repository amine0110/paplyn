const LOCAL_COLLAB_PORT = process.env.COLLAB_PORT || "1234";

function isSelfHostedMode(): boolean {
  return (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE || process.env.DEPLOYMENT_MODE || "selfhosted") !== "saas";
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost")
  );
}

function isLocalCollabUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return false;
    }
    return isLocalHost(parsed.hostname);
  } catch {
    return false;
  }
}

function deriveCollabUrlFromRequest(request: Request): string | null {
  const origin = getRequestOrigin(request);
  if (!origin) {
    return null;
  }

  const url = new URL(origin);
  if (isLocalHost(url.hostname)) {
    return `ws://${url.hostname}:${LOCAL_COLLAB_PORT}`;
  }

  const wsProto = url.protocol === "https:" ? "wss" : "ws";
  return `${wsProto}://${url.host}`;
}

/** Server-side canonical app URL — prefers runtime env over build-time NEXT_PUBLIC. */
export function getServerAppUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

/**
 * Derive the request's public origin from Host / proxy headers (not the Origin header).
 * Safe for self-host CSRF checks: only reflects how the client reached this server.
 */
export function getRequestOrigin(request: Request): string | null {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.split(",")[0]?.trim();

  if (!host) {
    try {
      return new URL(request.url).origin;
    } catch {
      return null;
    }
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  let protocol = forwardedProto;
  if (!protocol) {
    try {
      protocol = new URL(request.url).protocol.replace(":", "");
    } catch {
      protocol = "http";
    }
  }

  if (protocol !== "http" && protocol !== "https") {
    return null;
  }

  return `${protocol}://${host}`;
}

/** Trusted origins for better-auth in self-host mode. */
export function getSelfHostedTrustedOrigins(request?: Request): string[] {
  const origins = new Set<string>([getServerAppUrl()]);

  if (request) {
    const requestOrigin = getRequestOrigin(request);
    if (requestOrigin) {
      origins.add(requestOrigin);
    }
  }

  return [...origins];
}

/**
 * Resolve the collab websocket base URL for the browser.
 * Explicit env wins; otherwise derive from the incoming request in self-host mode.
 */
export function resolveCollabUrl(request?: Request): string {
  const explicit = process.env.COLLAB_URL || process.env.NEXT_PUBLIC_COLLAB_URL;

  if (explicit) {
    const normalized = explicit.replace(/\/$/, "");

    if (isSelfHostedMode() && request && isLocalCollabUrl(normalized)) {
      const origin = getRequestOrigin(request);
      if (origin && !isLocalHost(new URL(origin).hostname)) {
        const derived = deriveCollabUrlFromRequest(request);
        if (derived) {
          return derived;
        }
      }
    }

    return normalized;
  }

  if (isSelfHostedMode() && request) {
    const derived = deriveCollabUrlFromRequest(request);
    if (derived) {
      return derived;
    }
  }

  return "ws://localhost:1234";
}

/** Resolve collab HTTP base URL from the websocket URL (for server-to-server calls). */
export function resolveCollabHttpUrl(request?: Request): string {
  return resolveCollabUrl(request).replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
}

export function getCollabWsUrl(projectId: string, token: string, request?: Request): string {
  const base = resolveCollabUrl(request).replace(/\/$/, "");
  return `${base}/${projectId}?token=${encodeURIComponent(token)}`;
}
