import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runCollabSaveFallback } from "@/lib/collab-save-fallback";

describe("runCollabSaveFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns true when HTTP file save and collab replace both succeed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/files")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes("/collab/replace-text")) {
        return new Response(JSON.stringify({ ok: true, bound: true }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const ok = await runCollabSaveFallback(
      { projectId: "proj-1", path: "main.tex", content: "hello" },
      fetchMock
    );

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/projects/proj-1/files");
    expect(fetchMock.mock.calls[1][0]).toContain("/api/projects/proj-1/collab/replace-text");
  });

  it("returns false when HTTP file save fails", async () => {
    const fetchMock = vi.fn(async () => new Response("error", { status: 500 }));

    const ok = await runCollabSaveFallback(
      { projectId: "proj-1", path: "main.tex", content: "hello" },
      fetchMock
    );

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns false when collab replace fails after HTTP succeeds", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/files")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("collab down", { status: 502 });
    });

    const ok = await runCollabSaveFallback(
      { projectId: "proj-1", path: "main.tex", content: "hello" },
      fetchMock
    );

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
