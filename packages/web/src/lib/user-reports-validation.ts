import { z } from "zod";
import { sanitizePlainText } from "@/lib/user-reports-sanitize";

export const REPORT_TITLE_MAX = 120;
export const REPORT_WHAT_HAPPENED_MAX = 4000;
export const REPORT_STEPS_MAX = 2000;
export const REPORT_EMAIL_MAX = 254;
export const REPORT_PAGE_MAX = 500;

export const reportSourceSchema = z.enum(["report", "error"]);

const optionalEmailSchema = z
  .string()
  .trim()
  .max(REPORT_EMAIL_MAX)
  .email("Enter a valid email address")
  .optional()
  .or(z.literal(""));

export const userReportBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(REPORT_TITLE_MAX, `Title must be ${REPORT_TITLE_MAX} characters or fewer`),
  whatHappened: z
    .string()
    .trim()
    .min(1, "Please describe what happened")
    .max(
      REPORT_WHAT_HAPPENED_MAX,
      `Description must be ${REPORT_WHAT_HAPPENED_MAX} characters or fewer`,
    ),
  steps: z
    .string()
    .max(REPORT_STEPS_MAX, `Steps must be ${REPORT_STEPS_MAX} characters or fewer`)
    .optional()
    .default(""),
  email: optionalEmailSchema,
  page: z.string().max(REPORT_PAGE_MAX).optional().default(""),
  source: reportSourceSchema.optional().default("report"),
  honeypot: z.string().optional().default(""),
  csrfToken: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export type UserReportBody = z.infer<typeof userReportBodySchema>;

export type SanitizedUserReport = {
  title: string;
  whatHappened: string;
  steps: string;
  email: string | null;
  page: string;
  source: "Report page" | "Error";
  signedIn: boolean;
  receivedDate: string;
};

export function mapReportSourceToNotion(source: "report" | "error"): "Report page" | "Error" {
  return source === "error" ? "Error" : "Report page";
}

export function sanitizeUserReportInput(
  data: UserReportBody,
  options: { signedIn: boolean; sessionEmail?: string | null },
): SanitizedUserReport {
  const title = sanitizePlainText(data.title.trim()).slice(0, REPORT_TITLE_MAX);
  const whatHappened = sanitizePlainText(data.whatHappened.trim()).slice(0, REPORT_WHAT_HAPPENED_MAX);
  const steps = sanitizePlainText((data.steps ?? "").trim()).slice(0, REPORT_STEPS_MAX);
  const rawPage = (data.page ?? "").trim();
  const page = sanitizePlainText(rawPage || "/report").slice(0, REPORT_PAGE_MAX);

  let email: string | null = null;
  if (options.signedIn && options.sessionEmail?.trim()) {
    email = sanitizePlainText(options.sessionEmail.trim()).slice(0, REPORT_EMAIL_MAX);
  } else if (data.email && data.email.trim()) {
    email = sanitizePlainText(data.email.trim()).slice(0, REPORT_EMAIL_MAX);
  }

  const today = new Date();
  const receivedDate = today.toISOString().slice(0, 10);

  return {
    title,
    whatHappened,
    steps,
    email,
    page,
    source: mapReportSourceToNotion(data.source),
    signedIn: options.signedIn,
    receivedDate,
  };
}

export function buildReportPageBody(report: SanitizedUserReport): string {
  const lines = [report.title, "", "What happened", report.whatHappened];
  if (report.steps.trim()) {
    lines.push("", "Steps to reproduce", report.steps);
  }
  return lines.join("\n");
}
