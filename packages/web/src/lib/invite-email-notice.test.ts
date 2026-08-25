import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { resolveInviteEmailNotice } from "@/lib/invite-email-notice";

const ROOT = join(import.meta.dirname, "..");

describe("invite email notice (client-safe)", () => {
  it("share-dialog imports only client-safe invite notice helpers", () => {
    const src = readFileSync(join(ROOT, "components/share-dialog.tsx"), "utf8");
    expect(src).toContain('@/lib/invite-email-notice"');
    expect(src).not.toContain("invite-email-status-server");
    expect(src).not.toContain("@/lib/email/send");
  });

  it("returns null notice for link-only status", () => {
    expect(
      resolveInviteEmailNotice({ emailSent: false, emailStatus: "not-applicable" })
    ).toBeNull();
  });

  it("shows already-member copy instead of invite failure", () => {
    expect(
      resolveInviteEmailNotice({ emailSent: false, emailStatus: "already-member" })?.message
    ).toBe("They are already on this project.");
  });

  it("shows invite failure reason for not-configured status", () => {
    const notice = resolveInviteEmailNotice({
      emailSent: false,
      emailStatus: "not-configured",
      emailReason: "Email is not configured on this server (SMTP credentials missing).",
    });
    expect(notice?.message).toContain("Invite created.");
    expect(notice?.message).toContain("SMTP credentials missing");
  });
});
