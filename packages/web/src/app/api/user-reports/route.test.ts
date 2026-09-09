import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/user-reports/route";
import { getSession } from "@/lib/session";
import { createNotionUserReport } from "@/lib/notion-user-reports";
import {
  createUserReportCsrfToken,
  USER_REPORT_CSRF_COOKIE,
  USER_REPORT_CSRF_HEADER,
} from "@/lib/user-reports-csrf";
import { clearReportRateLimitStores } from "@/lib/user-reports-rate-limit";

const originalEnv = { ...process.env };
const TEST_DATABASE_ID = "a1b2c3d4e5f6478990abcdef12345678";

function enableUserReportsEnv() {
  process.env.NOTION_USER_REPORTS_TOKEN = "secret";
  process.env.NOTION_USER_REPORTS_DATABASE_ID = TEST_DATABASE_ID;
}

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => null),
}));

vi.mock("@/lib/notion-user-reports", () => ({
  createNotionUserReport: vi.fn(async () => ({ ok: true, pageId: "page-1" })),
}));

vi.mock("@/lib/user-reports-turnstile", () => ({
  verifyTurnstileToken: vi.fn(async () => true),
}));

function restoreEnv() {
  process.env = { ...originalEnv };
}

function makeRequest(body: Record<string, unknown>, csrfToken?: string) {
  const token = csrfToken ?? createUserReportCsrfToken();
  const request = new NextRequest("http://localhost:3000/api/user-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [USER_REPORT_CSRF_HEADER]: token,
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
  request.cookies.set(USER_REPORT_CSRF_COOKIE, token);
  return request;
}

describe("POST /api/user-reports", () => {
  afterEach(() => {
    restoreEnv();
    clearReportRateLimitStores();
    vi.clearAllMocks();
  });

  it("rejects honeypot submissions", async () => {
    enableUserReportsEnv();
    const response = await POST(
      makeRequest({
        title: "Bug",
        whatHappened: "Broken",
        honeypot: "spam",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects missing CSRF token", async () => {
    enableUserReportsEnv();
    const request = new NextRequest("http://localhost:3000/api/user-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bug", whatHappened: "Broken" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("accepts valid submissions when configured", async () => {
    enableUserReportsEnv();
    const response = await POST(
      makeRequest({
        title: "Compile failed",
        whatHappened: "No PDF",
        source: "error",
        page: "/project/1",
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("accepts auto-detected error reports without turnstile", async () => {
    enableUserReportsEnv();
    const { verifyTurnstileToken } = await import("@/lib/user-reports-turnstile");
    vi.mocked(verifyTurnstileToken).mockClear();

    const response = await POST(
      makeRequest({
        title: "Compile failed",
        whatHappened: "Undefined control sequence",
        source: "error",
        page: "/project/1",
        autoDetected: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("passes signed-in session email and defaults page to /report", async () => {
    enableUserReportsEnv();
    vi.mocked(getSession).mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "signed@example.com",
        name: "Amine",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        image: null,
        role: "user",
      },
      session: {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 60_000),
        token: "token",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as Awaited<ReturnType<typeof getSession>>);

    const response = await POST(
      makeRequest({
        title: "AI model not working",
        whatHappened: "I tried using the AI box but it didn't work",
        source: "report",
      }),
    );

    expect(response.status).toBe(200);
    expect(createNotionUserReport).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "signed@example.com",
        signedIn: true,
        page: "/report",
        whatHappened: "I tried using the AI box but it didn't work",
      }),
    );
  });

  it("returns 503 when reports are not configured", async () => {
    delete process.env.NOTION_USER_REPORTS_TOKEN;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_USER_REPORTS_DATABASE_ID;
    const response = await POST(
      makeRequest({
        title: "Bug",
        whatHappened: "Broken",
      }),
    );
    expect(response.status).toBe(503);
  });
});
