import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/user-reports/csrf/route";
import { USER_REPORT_CSRF_COOKIE } from "@/lib/user-reports-csrf";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe("GET /api/user-reports/csrf", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("returns 503 when reports are not configured", async () => {
    delete process.env.NOTION_USER_REPORTS_TOKEN;
    delete process.env.NOTION_TOKEN;
    const response = await GET();
    expect(response.status).toBe(503);
  });

  it("mints a CSRF cookie and token when configured", async () => {
    process.env.NOTION_USER_REPORTS_TOKEN = "secret";
    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(typeof data.csrfToken).toBe("string");
    expect(data.csrfToken.length).toBeGreaterThan(0);

    const setCookie = response.cookies.get(USER_REPORT_CSRF_COOKIE);
    expect(setCookie?.value).toBe(data.csrfToken);
    expect(setCookie?.httpOnly).toBe(true);
    expect(setCookie?.sameSite).toBe("strict");
    expect(setCookie?.path).toBe("/api/user-reports");
  });
});
