import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveProjectFile } from "@/lib/save-file";

describe("saveProjectFile", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok when the server accepts the file", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    const result = await saveProjectFile("proj-1", "main.tex", "\\documentclass{article}");

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns failure when the server rejects the request", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 413,
      text: async () => "Payload too large",
    } as Response);

    const result = await saveProjectFile("proj-1", "main.tex", "x".repeat(300000));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.error).toContain("413");
    }
  });

  it("retries once when retry is enabled", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const result = await saveProjectFile("proj-1", "main.tex", "content", false, { retry: true });

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry by default", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, text: async () => "" } as Response);

    const result = await saveProjectFile("proj-1", "main.tex", "content");

    expect(result.ok).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
