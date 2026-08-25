import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSessionCookie = vi.fn();

vi.mock("better-auth/cookies", () => ({
  getSessionCookie,
}));

describe("middleware auth gate", () => {
  beforeEach(() => {
    getSessionCookie.mockReset();
  });

  it("redirects unauthenticated dashboard visits to login before the page loads", async () => {
    getSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const request = new NextRequest("https://paplyn.test/dashboard");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://paplyn.test/login?next=%2Fdashboard"
    );
  });

  it("redirects unauthenticated settings visits to login before the page loads", async () => {
    getSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const request = new NextRequest("https://paplyn.test/settings");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://paplyn.test/login?next=%2Fsettings"
    );
  });

  it("allows protected routes when a session cookie is present", async () => {
    getSessionCookie.mockReturnValue("session-token");
    const { middleware } = await import("@/middleware");

    const request = new NextRequest("https://paplyn.test/dashboard");
    const response = middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
