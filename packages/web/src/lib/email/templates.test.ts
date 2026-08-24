import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  renderInviteEmail,
  renderProjectAddedEmail,
  renderResetPasswordEmail,
} from "@/lib/email/templates";

const APP_URL = "https://app.plicum.test";

function expectBrandedWordmarkHeader(html: string, appUrl = APP_URL): void {
  const base = appUrl.replace(/\/$/, "");
  expect(html).toContain(`${base}/brand/plicum-wordmark-light.png`);
  expect(html).toContain('alt="Plicum"');
  expect(html).toContain('align="center"');
  expect(html).toContain("display:block;margin:0 auto");
  expect(html).not.toMatch(/width:28px;height:28px/);
  expect(html).not.toMatch(/Georgia.*>P</);
}

describe("email templates", () => {
  it("renders invite email with project name, invite URL, and CTA", () => {
    const inviteUrl = "https://app.plicum.test/invite/inv-123";
    const { subject, html, text } = renderInviteEmail({
      ownerName: "Ada Lovelace",
      projectName: "Dissertation Draft",
      roleLabel: "Can edit",
      inviteUrl,
      appUrl: APP_URL,
    });

    expect(subject).toBe("Ada Lovelace invited you to Dissertation Draft on Plicum");
    expect(html).toContain("Dissertation Draft");
    expect(html).toContain(inviteUrl);
    expect(html).toContain("Open the manuscript");
    expectBrandedWordmarkHeader(html);
    expect(text).toContain("Dissertation Draft");
    expect(text).toContain(inviteUrl);
    expect(text).toContain("Can edit");
  });

  it("renders project-added email with wordmark and project URL", () => {
    const projectUrl = "https://app.plicum.test/project/proj-1";
    const { subject, html, text } = renderProjectAddedEmail({
      ownerName: "Ada Lovelace",
      projectName: "Dissertation Draft",
      roleLabel: "Can edit",
      projectUrl,
      appUrl: APP_URL,
    });

    expect(subject).toBe("Ada Lovelace added you to Dissertation Draft on Plicum");
    expect(html).toContain("added you to");
    expect(html).toContain(projectUrl);
    expectBrandedWordmarkHeader(html);
    expect(text).toContain(projectUrl);
  });

  it("renders reset password email with branded wordmark header", () => {
    const resetUrl = "https://app.plicum.test/reset/token-abc";
    const { subject, html, text } = renderResetPasswordEmail({
      userName: "Ada Lovelace",
      resetUrl,
      appUrl: APP_URL,
    });

    expect(subject).toBe("Reset your Plicum password");
    expect(html).toContain("Reset password");
    expect(html).toContain(resetUrl);
    expectBrandedWordmarkHeader(html);
    expect(text).toContain(resetUrl);
  });

  it("builds wordmark URL from appUrl without trailing slash", () => {
    const { html } = renderInviteEmail({
      ownerName: "Owner",
      projectName: "Paper",
      roleLabel: "Can view",
      inviteUrl: "https://app.plicum.test/invite/inv-1",
      appUrl: "https://app.plicum.test/",
    });

    expect(html).toContain("https://app.plicum.test/brand/plicum-wordmark-light.png");
    expect(html).not.toContain("https://app.plicum.test//brand/");
  });

  it("escapes HTML in user-provided names and project titles", () => {
    const maliciousTitle = '<script>alert("xss")</script>';
    const { html, text } = renderInviteEmail({
      ownerName: 'Eve <evil>',
      projectName: maliciousTitle,
      roleLabel: "Can view",
      inviteUrl: "https://app.plicum.test/invite/inv-1",
      appUrl: APP_URL,
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain(escapeHtml(maliciousTitle));
    expect(html).toContain("&lt;evil&gt;");
    expectBrandedWordmarkHeader(html);
    expect(text).toContain(maliciousTitle);
  });
});
