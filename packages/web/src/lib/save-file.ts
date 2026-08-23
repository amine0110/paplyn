export type SaveFileResult =
  | { ok: true }
  | { ok: false; status?: number; error: string };

export type SaveProjectFileOptions = {
  /** Retry once after a failed attempt (network or HTTP error). */
  retry?: boolean;
};

/**
 * POST project file content to the HTTP API and verify the server accepted it.
 */
export async function saveProjectFile(
  projectId: string,
  path: string,
  content: string,
  isBinary = false,
  options?: SaveProjectFileOptions
): Promise<SaveFileResult> {
  const url = `/api/projects/${projectId}/files`;
  const body = JSON.stringify({ path, content, isBinary });

  const attempt = async (): Promise<SaveFileResult> => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        const suffix = detail ? `: ${detail.slice(0, 200)}` : "";
        return { ok: false, status: res.status, error: `HTTP ${res.status}${suffix}` };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  };

  const first = await attempt();
  if (first.ok || !options?.retry) return first;
  return attempt();
}
