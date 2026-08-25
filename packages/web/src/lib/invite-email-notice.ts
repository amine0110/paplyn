export type InviteEmailStatus =
  | "sent"
  | "not-configured"
  | "send-failed"
  | "not-applicable"
  | "already-member";

export interface InviteEmailResponseFields {
  emailSent: boolean;
  emailStatus: InviteEmailStatus;
  emailReason?: string;
}

export type InviteNoticeTone = "success" | "muted";

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
