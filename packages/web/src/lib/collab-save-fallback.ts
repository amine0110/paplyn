import { saveProjectFile } from "./save-file";

export type CollabSaveFallbackParams = {
  projectId: string;
  path: string;
  content: string;
};

/**
 * Fallback persist when collab WS debounce/ack path fails:
 * 1) HTTP project_file upsert
 * 2) collab replace-text (via Next API proxy)
 */
export async function runCollabSaveFallback(
  params: CollabSaveFallbackParams,
  fetchFn: typeof fetch = fetch
): Promise<boolean> {
  const fileResult = await saveProjectFile(
    params.projectId,
    params.path,
    params.content,
    false,
    { retry: true, fetchFn }
  );
  if (!fileResult.ok) {
    console.error("[save-fallback] HTTP file save failed:", params.path, fileResult.error);
    return false;
  }

  try {
    const res = await fetchFn(`/api/projects/${params.projectId}/collab/replace-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: params.path, content: params.content }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        "[save-fallback] collab replace failed:",
        params.path,
        res.status,
        detail.slice(0, 200)
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[save-fallback] collab replace network error:", err);
    return false;
  }
}
