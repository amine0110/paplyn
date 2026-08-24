import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport,
  },
}));

import {
  EMAIL_NOT_CONFIGURED_REASON,
  formatEmailFailureReason,
  isSmtpConfigured,
  sendPlicumEmail,
} from "@/lib/email/send";

describe("sendPlicumEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports missing SMTP without calling nodemailer", async () => {
    const result = await sendPlicumEmail({
      to: "guest@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result).toEqual({ sent: false, reason: "not-configured" });
    expect(createTransport).not.toHaveBeenCalled();
    expect(isSmtpConfigured()).toBe(false);
  });

  it("isSmtpConfigured is true when user and pass are set", () => {
    process.env.SMTP_USER = "hello@example.com";
    process.env.SMTP_PASS = "secret-pass";
    expect(isSmtpConfigured()).toBe(true);
  });

  it("regression: does not report not-configured when SMTP credentials are present", async () => {
    process.env.SMTP_USER = "hello@example.com";
    process.env.SMTP_PASS = "secret-pass";
    sendMail.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendPlicumEmail({
      to: "guest@example.com",
      subject: "Invite",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result).toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalled();
  });

  it("sends when SMTP is configured", async () => {
    process.env.SMTP_USER = "hello@example.com";
    process.env.SMTP_PASS = "secret-pass";
    sendMail.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendPlicumEmail({
      to: "guest@example.com",
      subject: "Invite",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result).toEqual({ sent: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        auth: { user: "hello@example.com", pass: "secret-pass" },
      })
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Invite",
      })
    );
  });

  it("returns send-failed with redacted error when transport throws", async () => {
    process.env.SMTP_USER = "hello@example.com";
    process.env.SMTP_PASS = "secret-pass";
    sendMail.mockRejectedValue(new Error("Invalid login: secret-pass rejected"));

    const result = await sendPlicumEmail({
      to: "guest@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result.sent).toBe(false);
    if (!result.sent) {
      expect(result.reason).toBe("send-failed");
      expect(result.error).toContain("[REDACTED]");
      expect(result.error).not.toContain("secret-pass");
    }
  });

  it("formatEmailFailureReason surfaces not-configured message for the UI", () => {
    expect(
      formatEmailFailureReason({ sent: false, reason: "not-configured" })
    ).toBe(EMAIL_NOT_CONFIGURED_REASON);
  });

  it("formatEmailFailureReason surfaces send errors for the UI", () => {
    expect(
      formatEmailFailureReason({
        sent: false,
        reason: "send-failed",
        error: "Connection timeout",
      })
    ).toBe("Email could not be sent: Connection timeout");
  });
});
