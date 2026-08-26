import { NextResponse } from "next/server";
import {
  createUserReportCsrfToken,
  getUserReportCsrfCookieOptions,
  USER_REPORT_CSRF_COOKIE,
} from "@/lib/user-reports-csrf";
import { isUserReportsEnabled } from "@/lib/user-reports-config";

export async function GET() {
  if (!isUserReportsEnabled()) {
    return NextResponse.json({ error: "User reports are not configured" }, { status: 503 });
  }

  const csrfToken = createUserReportCsrfToken();
  const response = NextResponse.json({ ok: true, csrfToken });
  response.cookies.set(USER_REPORT_CSRF_COOKIE, csrfToken, getUserReportCsrfCookieOptions());
  return response;
}
