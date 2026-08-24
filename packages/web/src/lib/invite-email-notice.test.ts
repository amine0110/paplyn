import { describe, it, expect } from "vitest";
import { resolveInviteEmailNotice } from "@/lib/invite-email-notice";
import { EMAIL_NOT_CONFIGURED_REASON } from "@/lib/email/send";

describe("resolveInviteEmailNotice", () => {
  it("returns null when emailSent is undefined (link-only invite)", () => {
    expect(resolveInviteEmailNotice(undefined)).toBeNull();
  });

  it("returns success copy when email was sent", () => {
    expect(resolveInviteEmailNotice(true)).toEqual({
      notice: "sent",
      message: "Invite email sent.",
    });
  });

  it("includes server reason when email was not sent", () => {
    expect(resolveInviteEmailNotice(false, EMAIL_NOT_CONFIGURED_REASON)).toEqual({
      notice: "not-sent",
      message: `Invite created; ${EMAIL_NOT_CONFIGURED_REASON}`,
    });
  });

  it("falls back to generic copy when reason is missing", () => {
    expect(resolveInviteEmailNotice(false)).toEqual({
      notice: "not-sent",
      message: "Invite created; email not sent.",
    });
  });
});
