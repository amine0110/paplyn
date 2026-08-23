import nodemailer from "nodemailer";

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "send-failed"; error?: string };

export interface SendPlicumEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || "587"),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "Plicum <hello.plicum@gmail.com>",
  };
}

export function isSmtpConfigured(): boolean {
  const { user, pass } = getSmtpConfig();
  return Boolean(user && pass);
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
    console.error(`[email] Failed to send to ${to}:`, message);
    return { sent: false, reason: "send-failed", error: message };
  }
}
