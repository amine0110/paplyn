import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendPlicumEmail } from "@/lib/email/send";

describe("sendPlicumEmail", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops when SMTP credentials are unset", async () => {
    const result = await sendPlicumEmail({
      to: "guest@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(result).toEqual({ sent: false, reason: "not-configured" });
  });
});
