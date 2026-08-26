import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/user-reports/route";
import {
  createUserReportCsrfToken,
  USER_REPORT_CSRF_COOKIE,
  USER_REPORT_CSRF_HEADER,
} from "@/lib/user-reports-csrf";
import { clearReportRateLimitStores } from "@/lib/user-reports-rate-limit";

const originalEnv = { ...process.env };

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
    process.env.NOTION_USER_REPORTS_TOKEN = "secret";
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
    process.env.NOTION_USER_REPORTS_TOKEN = "secret";
    const request = new NextRequest("http://localhost:3000/api/user-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Bug", whatHappened: "Broken" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("accepts valid submissions when configured", async () => {
    process.env.NOTION_USER_REPORTS_TOKEN = "secret";
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

  it("returns 503 when reports are not configured", async () => {
    delete process.env.NOTION_USER_REPORTS_TOKEN;
    delete process.env.NOTION_TOKEN;
    const response = await POST(
      makeRequest({
        title: "Bug",
        whatHappened: "Broken",
      }),
    );
    expect(response.status).toBe(503);
  });
});
