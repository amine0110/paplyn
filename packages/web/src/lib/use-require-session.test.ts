// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRequireSession } from "@/lib/use-require-session";

const useSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  useSession: () => useSession(),
}));

describe("useRequireSession", () => {
  beforeEach(() => {
    useSession.mockReset();
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("redirects to login when session is absent", async () => {
    useSession.mockReturnValue({ data: null, isPending: false });

    renderHook(() => useRequireSession({ loginNext: "/dashboard" }));

    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith("/login?next=%2Fdashboard");
    });
  });

  it("does not redirect while session is pending", () => {
    useSession.mockReturnValue({ data: null, isPending: true });

    renderHook(() => useRequireSession());

    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("does not redirect when authenticated", () => {
    useSession.mockReturnValue({
      data: { user: { id: "u1", email: "a@b.com" } },
      isPending: false,
    });

    const { result } = renderHook(() => useRequireSession());

    expect(window.location.assign).not.toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(true);
  });
});
