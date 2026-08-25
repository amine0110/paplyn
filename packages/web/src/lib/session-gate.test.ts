import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

const getSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

describe("requireAuth server gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects unauthenticated dashboard access to login", async () => {
    getSession.mockResolvedValue(null);
    const { requireAuth } = await import("@/lib/session");

    await expect(requireAuth("/dashboard")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fdashboard");
  });

  it("redirects unauthenticated settings access to login", async () => {
    getSession.mockResolvedValue(null);
    const { requireAuth } = await import("@/lib/session");

    await expect(requireAuth("/settings")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fsettings");
  });

  it("returns the session when authenticated", async () => {
    const session = { user: { id: "u1", email: "a@b.com", role: "user" } };
    getSession.mockResolvedValue(session);
    const { requireAuth } = await import("@/lib/session");

    const result = await requireAuth("/dashboard");

    expect(redirect).not.toHaveBeenCalled();
    expect(result.user).toEqual(session.user);
  });
});
