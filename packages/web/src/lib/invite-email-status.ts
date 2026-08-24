import { formatEmailFailureReason, type SendEmailResult } from "@/lib/email/send";

export type InviteEmailStatus =
  | "sent"
  | "not-configured"
  | "send-failed"
  | "not-applicable"
  | "added-existing-user"
  | "already-member";

export interface InviteEmailResponseFields {
  emailSent: boolean;
  emailStatus: InviteEmailStatus;
  emailReason?: string;
}

export type InviteNoticeTone = "success" | "muted";

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

export function addedExistingUserEmailFields(
  result: SendEmailResult
): InviteEmailResponseFields {
  return {
    emailSent: result.sent,
    emailStatus: "added-existing-user",
    ...(result.sent ? {} : { emailReason: formatEmailFailureReason(result) }),
  };
}

export function resolveInviteEmailNotice(
  fields: InviteEmailResponseFields
): { tone: InviteNoticeTone; message: string } | null {
  switch (fields.emailStatus) {
    case "not-applicable":
      return null;
    case "already-member":
      return { tone: "muted", message: "They are already on this project." };
    case "sent":
      return { tone: "success", message: "Invite email sent." };
    case "added-existing-user":
      if (fields.emailSent) {
        return { tone: "success", message: "Added to the project. Notification email sent." };
      }
      return {
        tone: "muted",
        message: fields.emailReason
          ? `Added to the project. ${fields.emailReason}`
          : "Added to the project. Notification email could not be sent.",
      };
    case "not-configured":
    case "send-failed":
      return {
        tone: "muted",
        message: fields.emailReason
          ? `Invite created. ${fields.emailReason}`
          : "Invite created. Email could not be sent.",
      };
  }
}
