import { cookies } from "next/headers";
import { ReportForm } from "@/app/report/report-form";
import { getSession } from "@/lib/session";
import { isInternalAppPath } from "@/lib/internal-path";
import {
  createUserReportCsrfToken,
  USER_REPORT_CSRF_COOKIE,
} from "@/lib/user-reports-csrf";
import {
  getTurnstileSiteKey,
  isUserReportsEnabled,
} from "@/lib/user-reports-config";
import { reportSourceSchema } from "@/lib/user-reports-validation";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  searchParams: Promise<{
    source?: string;
    page?: string;
    title?: string;
    what?: string;
    steps?: string;
  }>;
};

function parseSource(value: string | undefined): "report" | "error" {
  const parsed = reportSourceSchema.safeParse(value);
  return parsed.success ? parsed.data : "report";
}

function parsePage(value: string | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim().slice(0, 500);
  return isInternalAppPath(trimmed) ? trimmed : "";
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const csrfToken = createUserReportCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(USER_REPORT_CSRF_COOKIE, csrfToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/user-reports",
  });

  const session = await getSession();
  const signedIn = Boolean(session?.user);
  const sessionEmail = session?.user?.email ?? null;

  return (
    <ReportForm
      csrfToken={csrfToken}
      reportsEnabled={isUserReportsEnabled()}
      turnstileSiteKey={getTurnstileSiteKey()}
      signedIn={signedIn}
      sessionEmail={sessionEmail}
      initialSource={parseSource(params.source)}
      initialPage={parsePage(params.page)}
      initialTitle={params.title?.slice(0, 120) ?? ""}
      initialWhatHappened={params.what?.slice(0, 4000) ?? ""}
      initialSteps={params.steps?.slice(0, 2000) ?? ""}
    />
  );
}
