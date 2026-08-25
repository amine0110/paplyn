// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-client", () => ({
  signOut,
}));

describe("auth-redirect", () => {
  beforeEach(() => {
    vi.resetModules();
    signOut.mockReset();
    signOut.mockResolvedValue(undefined);
    vi.stubGlobal("location", { assign: vi.fn() });
  });

  it("signOutAndLeave signs out then navigates home", async () => {
    const { signOutAndLeave } = await import("@/lib/auth-redirect");
    await signOutAndLeave();
    expect(signOut).toHaveBeenCalledOnce();
    expect(window.location.assign).toHaveBeenCalledWith("/");
  });

  it("leaveForLogin encodes the next path", async () => {
    const { leaveForLogin } = await import("@/lib/auth-redirect");
    leaveForLogin("/settings");
    expect(window.location.assign).toHaveBeenCalledWith("/login?next=%2Fsettings");
  });
});
