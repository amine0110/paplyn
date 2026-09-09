import nodemailer from "nodemailer";
import { PRODUCT_NAME } from "../product";

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "send-failed"; error?: string };

export const EMAIL_NOT_CONFIGURED_REASON =
  "Email is not configured on this server (SMTP credentials missing).";

const SECRET_PATTERNS: RegExp[] = [
  /(?:password|passwd|secret|api[_-]?key|token|auth(?:orization)?)\s*[:=]\s*\S+/gi,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9+/=._-]+/gi,
];

function redactSecrets(text: string): string {
  let redacted = text;
  const pass = process.env.SMTP_PASS;
  if (pass && pass.length > 0) {
    redacted = redacted.split(pass).join("[REDACTED]");
  }
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export function formatEmailFailureReason(
  result: Extract<SendEmailResult, { sent: false }>
): string {
  if (result.reason === "not-configured") {
    return EMAIL_NOT_CONFIGURED_REASON;
  }
  if (result.error) {
    return `Email could not be sent: ${redactSecrets(result.error)}`;
  }
  return "Email could not be sent.";
}

export interface SendPlicumEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim() || "";
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 587;
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const from = process.env.SMTP_FROM?.trim() || `${PRODUCT_NAME} <noreply@example.com>`;
  return { host, port, user, pass, from };
}

export function isSmtpConfigured(): boolean {
  const { host, user, pass } = getSmtpConfig();
  return Boolean(host && user && pass);
}

export async function sendPlicumEmail({
  to,
  subject,
  html,
  text,
}: SendPlicumEmailParams): Promise<SendEmailResult> {
  const { host, port, user, pass, from } = getSmtpConfig();

  if (!user || !pass) {
    console.warn(`[email] SMTP not configured; skipping send to ${to}`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transport.sendMail({ from, to, subject, html, text });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = redactSecrets(message);
    console.error(`[email] Failed to send to ${to}:`, safeMessage);
    return { sent: false, reason: "send-failed", error: safeMessage };
  }
}
