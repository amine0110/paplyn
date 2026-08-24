import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveInviteEmailNotice } from "@/lib/invite-email-notice";
import { EMAIL_NOT_CONFIGURED_REASON } from "@/lib/email/send";

function InviteNotice({ emailSent, emailReason }: { emailSent: boolean; emailReason?: string }) {
  const notice = resolveInviteEmailNotice(emailSent, emailReason);
  if (!notice) return null;
  return (
    <p
      className={notice.notice === "sent" ? "text-accent" : "text-ink-muted"}
      role="status"
    >
      {notice.message}
    </p>
  );
}

describe("Share invite email notice copy", () => {
  it("shows success message when emailSent is true", () => {
    render(<InviteNotice emailSent={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Invite email sent.");
  });

  it("shows server reason when email was not sent", () => {
    render(<InviteNotice emailSent={false} emailReason={EMAIL_NOT_CONFIGURED_REASON} />);
    expect(screen.getByRole("status")).toHaveTextContent(EMAIL_NOT_CONFIGURED_REASON);
    expect(screen.getByRole("status")).toHaveTextContent("Invite created;");
  });

  it("shows generic fallback when reason is missing", () => {
    render(<InviteNotice emailSent={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Invite created; email not sent.");
  });
});
