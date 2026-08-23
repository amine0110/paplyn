import { config } from "./config";
import { resolveCollabHttpUrl } from "./urls";

export type CollabReplaceServerResult =
  | { ok: true; bound: boolean; mainTexLength: number }
  | { ok: false; status?: number; error: string };

/**
 * Server-side call to collab replace-text HTTP endpoint.
 * Uses the same HMAC collab token as WebSocket auth.
 */
export async function replaceTextOnCollabServer(
  projectId: string,
  token: string,
  path: string,
  content: string,
  request?: Request
): Promise<CollabReplaceServerResult> {
  const base = resolveCollabHttpUrl(request).replace(/\/$/, "");
  const url = `${base}/rooms/${encodeURIComponent(projectId)}/replace-text`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path, content }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: `Collab replace failed: HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await res.json()) as { bound?: boolean; mainTexLength?: number };
    return {
      ok: true,
      bound: Boolean(data.bound),
      mainTexLength: data.mainTexLength ?? content.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Collab replace network error",
    };
  }
}

/** @internal exposed for tests */
export function getCollabSecret(): string {
  return config.collabSecret;
}
