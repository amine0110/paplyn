import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { resolveInviteEmailNotice } from "@/lib/invite-email-notice";
import { EMAIL_NOT_CONFIGURED_REASON } from "@/lib/email/send";

function InviteNotice({
  emailSent,
  emailStatus,
  emailReason,
}: {
  emailSent: boolean;
  emailStatus: Parameters<typeof resolveInviteEmailNotice>[0]["emailStatus"];
  emailReason?: string;
}) {
  const notice = resolveInviteEmailNotice({ emailSent, emailStatus, emailReason });
  if (!notice) return null;
  return (
    <p
      className={notice.tone === "success" ? "text-accent" : "text-ink-muted"}
      role="status"
    >
      {notice.message}
    </p>
  );
}

describe("Share invite email notice copy", () => {
  it("shows invite sent for sent status", () => {
    render(<InviteNotice emailSent={true} emailStatus="sent" />);
    expect(screen.getByRole("status")).toHaveTextContent("Invite email sent.");
  });

  it("shows invite failure reason for not-configured status", () => {
    render(
      <InviteNotice
        emailSent={false}
        emailStatus="not-configured"
        emailReason={EMAIL_NOT_CONFIGURED_REASON}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent(EMAIL_NOT_CONFIGURED_REASON);
    expect(screen.getByRole("status")).toHaveTextContent("Invite created.");
    expect(screen.getByRole("status")).not.toHaveTextContent("email not sent");
  });

  it("shows already-member copy instead of invite failure", () => {
    render(<InviteNotice emailSent={false} emailStatus="already-member" />);
    expect(screen.getByRole("status")).toHaveTextContent("They are already on this project.");
    expect(screen.getByRole("status")).not.toHaveTextContent("Invite created");
    expect(screen.getByRole("status")).not.toHaveTextContent("email not sent");
  });

  it("shows added + email failure without invite-created wording", () => {
    render(
      <InviteNotice
        emailSent={false}
        emailStatus="added-existing-user"
        emailReason="Email could not be sent: Connection refused"
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Added to the project.");
    expect(screen.getByRole("status")).not.toHaveTextContent("Invite created");
  });
});
