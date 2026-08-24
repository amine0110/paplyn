import { describe, it, expect } from "vitest";
import {
  addedExistingUserEmailFields,
  alreadyMemberEmailFields,
  inviteEmailFieldsFromSendResult,
  linkOnlyInviteEmailFields,
  resolveInviteEmailNotice,
} from "@/lib/invite-email-status";
import { EMAIL_NOT_CONFIGURED_REASON } from "@/lib/email/send";

describe("invite email status helpers", () => {
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
    expect(resolveInviteEmailNotice(alreadyMemberEmailFields())?.message).toBe(
      "They are already on this project."
    );
  });

  it("uses added-existing-user when notification email succeeds", () => {
    const fields = addedExistingUserEmailFields({ sent: true });
    expect(fields).toEqual({
      emailSent: true,
      emailStatus: "added-existing-user",
    });
    expect(resolveInviteEmailNotice(fields)?.message).toContain("Added to the project");
  });

  it("reports add + email failure without invite-created wording", () => {
    const fields = addedExistingUserEmailFields({
      sent: false,
      reason: "send-failed",
      error: "Connection refused",
    });
    const notice = resolveInviteEmailNotice(fields);
    expect(fields.emailStatus).toBe("added-existing-user");
    expect(notice?.message).toContain("Added to the project");
    expect(notice?.message).not.toContain("Invite created");
    expect(notice?.message).toContain("Connection refused");
  });

  it("returns null notice for link-only status", () => {
    expect(resolveInviteEmailNotice(linkOnlyInviteEmailFields())).toBeNull();
  });
});
