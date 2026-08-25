import { formatEmailFailureReason, type SendEmailResult } from "@/lib/email/send";
import type { InviteEmailResponseFields } from "@/lib/invite-email-notice";

export function inviteEmailFieldsFromSendResult(
  result: SendEmailResult
): InviteEmailResponseFields {
  if (result.sent) {
    return { emailSent: true, emailStatus: "sent" };
  }
  return {
    emailSent: false,
    emailStatus: result.reason === "not-configured" ? "not-configured" : "send-failed",
    emailReason: formatEmailFailureReason(result),
  };
}

export function linkOnlyInviteEmailFields(): InviteEmailResponseFields {
  return { emailSent: false, emailStatus: "not-applicable" };
}

export function alreadyMemberEmailFields(): InviteEmailResponseFields {
  return { emailSent: false, emailStatus: "already-member" };
}
