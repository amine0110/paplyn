import { describe, it, expect } from "vitest";
import { escapeHtml, renderInviteEmail } from "@/lib/email/templates";

describe("email templates", () => {
  it("renders invite email with project name, invite URL, and CTA", () => {
    const inviteUrl = "https://app.plicum.test/invite/inv-123";
    const { subject, html, text } = renderInviteEmail({
      ownerName: "Ada Lovelace",
      projectName: "Dissertation Draft",
      roleLabel: "Can edit",
      inviteUrl,
      appUrl: "https://app.plicum.test",
    });

    expect(subject).toBe("Ada Lovelace invited you to Dissertation Draft on Plicum");
    expect(html).toContain("Dissertation Draft");
    expect(html).toContain(inviteUrl);
    expect(html).toContain("Open the manuscript");
    expect(text).toContain("Dissertation Draft");
    expect(text).toContain(inviteUrl);
    expect(text).toContain("Can edit");
  });

  it("escapes HTML in user-provided names and project titles", () => {
    const maliciousTitle = '<script>alert("xss")</script>';
    const { html, text } = renderInviteEmail({
      ownerName: 'Eve <evil>',
      projectName: maliciousTitle,
      roleLabel: "Can view",
      inviteUrl: "https://app.plicum.test/invite/inv-1",
      appUrl: "https://app.plicum.test",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain(escapeHtml(maliciousTitle));
    expect(html).toContain("&lt;evil&gt;");
    expect(text).toContain(maliciousTitle);
  });
});
