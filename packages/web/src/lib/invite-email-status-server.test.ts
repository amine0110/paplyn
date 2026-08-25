import { describe, it, expect } from "vitest";
import {
  alreadyMemberEmailFields,
  inviteEmailFieldsFromSendResult,
  linkOnlyInviteEmailFields,
} from "@/lib/invite-email-status-server";
import { EMAIL_NOT_CONFIGURED_REASON } from "@/lib/email/send";

describe("invite email status server helpers", () => {
  it("maps successful send to sent status", () => {
    expect(inviteEmailFieldsFromSendResult({ sent: true })).toEqual({
      emailSent: true,
      emailStatus: "sent",
    });
  });

  it("maps SMTP missing to not-configured status with reason", () => {
    expect(inviteEmailFieldsFromSendResult({ sent: false, reason: "not-configured" })).toEqual({
      emailSent: false,
      emailStatus: "not-configured",
      emailReason: EMAIL_NOT_CONFIGURED_REASON,
    });
  });

  it("maps transport failure to send-failed status", () => {
    expect(
      inviteEmailFieldsFromSendResult({
        sent: false,
        reason: "send-failed",
        error: "Connection refused",
      })
    ).toEqual({
      emailSent: false,
      emailStatus: "send-failed",
      emailReason: "Email could not be sent: Connection refused",
    });
  });

  it("uses not-applicable for link-only invites", () => {
    expect(linkOnlyInviteEmailFields()).toEqual({
      emailSent: false,
      emailStatus: "not-applicable",
    });
  });

  it("uses already-member status without implying invite email failure", () => {
    expect(alreadyMemberEmailFields()).toEqual({
      emailSent: false,
      emailStatus: "already-member",
    });
  });
});
