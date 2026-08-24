export type InviteEmailNotice = "sent" | "not-sent";

export function resolveInviteEmailNotice(
  emailSent: boolean | undefined,
  emailReason?: string | null
): { notice: InviteEmailNotice; message: string } | null {
  if (emailSent === undefined) {
    return null;
  }
  if (emailSent) {
    return { notice: "sent", message: "Invite email sent." };
  }
  const reason = emailReason?.trim();
  return {
    notice: "not-sent",
    message: reason
      ? `Invite created; ${reason}`
      : "Invite created; email not sent.",
  };
}
