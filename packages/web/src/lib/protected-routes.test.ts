import { describe, it, expect } from "vitest";
import { isProtectedPath, loginRedirectUrl } from "@/lib/protected-routes";

describe("protected routes", () => {
  it("matches dashboard, settings, admin, and project paths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/billing")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/users")).toBe(true);
    expect(isProtectedPath("/project/abc-123")).toBe(true);
  });

  it("does not match public routes", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/signup")).toBe(false);
    expect(isProtectedPath("/invite/abc")).toBe(false);
  });

  it("builds login redirect URLs with next path", () => {
    expect(loginRedirectUrl("/dashboard")).toBe("/login?next=%2Fdashboard");
    expect(loginRedirectUrl("/settings")).toBe("/login?next=%2Fsettings");
  });
});
