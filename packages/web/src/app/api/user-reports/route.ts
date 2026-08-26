import { NextRequest, NextResponse } from "next/server";
import { createNotionUserReport } from "@/lib/notion-user-reports";
import { getSession } from "@/lib/session";
import {
  hashRateLimitKey,
  USER_REPORT_CSRF_COOKIE,
  USER_REPORT_CSRF_HEADER,
  verifyUserReportCsrf,
} from "@/lib/user-reports-csrf";
import { isUserReportsEnabled } from "@/lib/user-reports-config";
import { evaluateReportRateLimits } from "@/lib/user-reports-rate-limit";
import { verifyTurnstileToken } from "@/lib/user-reports-turnstile";
import {
  sanitizeUserReportInput,
  userReportBodySchema,
} from "@/lib/user-reports-validation";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) {
    return realIp.trim();
  }
  return "unknown";
}

export async function POST(request: NextRequest) {
  if (!isUserReportsEnabled()) {
    return NextResponse.json({ error: "User reports are not configured" }, { status: 503 });
  }

  const session = await getSession();
  const signedIn = Boolean(session?.user);
  const sessionEmail = session?.user?.email ?? null;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = userReportBodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Invalid report";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const body = parsed.data;

  if (body.honeypot.trim()) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const cookieToken = request.cookies.get(USER_REPORT_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(USER_REPORT_CSRF_HEADER);
  const providedCsrf = headerToken ?? body.csrfToken;
  if (!verifyUserReportCsrf(cookieToken, providedCsrf)) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 403 });
  }

  const clientIp = getClientIp(request);
  const ipKey = hashRateLimitKey(`ip:${clientIp}`);
  const rateLimit = evaluateReportRateLimits({
    ipKey,
    userId: session?.user?.id,
  });

  if (!rateLimit.allowed) {
    const headers: Record<string, string> = {};
    if (rateLimit.retryAfterSeconds) {
      headers["Retry-After"] = String(rateLimit.retryAfterSeconds);
    }
    return NextResponse.json(
      {
        error:
          rateLimit.reason === "user"
            ? "Too many reports from your account. Please try again later."
            : "Too many reports from this network. Please try again later.",
      },
      { status: 429, headers },
    );
  }

  if (!body.autoDetected) {
    const turnstileOk = await verifyTurnstileToken(body.turnstileToken, clientIp);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
    }
  }

  const report = sanitizeUserReportInput(body, { signedIn, sessionEmail });
  const result = await createNotionUserReport(report);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
