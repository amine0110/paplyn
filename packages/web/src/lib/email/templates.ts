import { BRAND } from "@/components/plicum-wordmark";
import { PRODUCT_NAME, PUBLIC_SITE_URL } from "@/lib/product";

const DEFAULT_APP_URL = PUBLIC_SITE_URL;

const ACCENT = "#3d8585";
const INK = "#1c1917";
const INK_MUTED = "#57534e";
const PAPER = "#f7f4ef";
const CARD = "#ffffff";
const BORDER = "#e7e2d9";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markImageUrl(appUrl: string): string {
  const base = (appUrl || DEFAULT_APP_URL).replace(/\/$/, "");
  return `${base}${BRAND.mark}`;
}

function brandHeaderHtml(appUrl: string): string {
  const src = escapeHtml(markImageUrl(appUrl));
  const name = escapeHtml(PRODUCT_NAME);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="text-align:center;padding:0 8px 0 0;vertical-align:middle;">
          <img src="${src}" alt="" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" />
        </td>
        <td align="center" style="text-align:left;vertical-align:middle;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;line-height:1;color:${INK};">${name}</span>
        </td>
      </tr>
    </table>
  `.trim();
}

function emailShell({
  productName,
  preheader,
  bodyHtml,
  appUrl,
}: {
  productName: string;
  preheader: string;
  bodyHtml: string;
  appUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(productName)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding-bottom:24px;text-align:center;">
              ${brandHeaderHtml(appUrl)}
            </td>
          </tr>
          <tr>
            <td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:32px 28px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;text-align:center;font-size:12px;line-height:1.5;color:${INK_MUTED};">
              From ${escapeHtml(productName)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 20px;">
      <tr>
        <td style="border-radius:8px;background:${ACCENT};">
          <a href="${safeHref}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${safeLabel}</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${INK_MUTED};">
      Or copy this link into your browser:
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;word-break:break-all;">
      <a href="${safeHref}" style="color:${ACCENT};text-decoration:underline;">${safeHref}</a>
    </p>
  `.trim();
}

export interface InviteEmailParams {
  productName?: string;
  ownerName: string;
  projectName: string;
  roleLabel: string;
  inviteUrl: string;
  appUrl: string;
}

export interface ProjectAddedEmailParams {
  productName?: string;
  ownerName: string;
  projectName: string;
  roleLabel: string;
  projectUrl: string;
  appUrl: string;
}

export function renderProjectAddedEmail({
  productName = PRODUCT_NAME,
  ownerName,
  projectName,
  roleLabel,
  projectUrl,
  appUrl,
}: ProjectAddedEmailParams): { subject: string; html: string; text: string } {
  const safeOwner = escapeHtml(ownerName);
  const safeProject = escapeHtml(projectName);
  const safeRole = escapeHtml(roleLabel);

  const subject = `${ownerName} added you to ${projectName} on ${productName}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">
      <strong>${safeOwner}</strong> added you to
      <strong>${safeProject}</strong> on ${escapeHtml(productName)}.
    </p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${INK_MUTED};">
      Your access: <strong style="color:${INK};">${safeRole}</strong>
    </p>
    ${ctaButton("Open the manuscript", projectUrl)}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${INK_MUTED};">
      If you didn&rsquo;t expect this, you can safely ignore this email.
    </p>
  `.trim();

  const html = emailShell({
    productName,
    preheader: `${ownerName} added you to ${projectName}`,
    bodyHtml,
    appUrl,
  });

  const text = [
    `${ownerName} added you to "${projectName}" on ${productName}.`,
    ``,
    `Your access: ${roleLabel}`,
    ``,
    `Open the manuscript: ${projectUrl}`,
    ``,
    `If you didn't expect this, you can safely ignore this email.`,
    ``,
    `— ${productName}`,
  ].join("\n");

  return { subject, html, text };
}

export function renderInviteEmail({
  productName = PRODUCT_NAME,
  ownerName,
  projectName,
  roleLabel,
  inviteUrl,
  appUrl,
}: InviteEmailParams): { subject: string; html: string; text: string } {
  const safeOwner = escapeHtml(ownerName);
  const safeProject = escapeHtml(projectName);
  const safeRole = escapeHtml(roleLabel);

  const subject = `${ownerName} invited you to ${projectName} on ${productName}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">
      <strong>${safeOwner}</strong> invited you to collaborate on
      <strong>${safeProject}</strong> on ${escapeHtml(productName)}.
    </p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${INK_MUTED};">
      Your access: <strong style="color:${INK};">${safeRole}</strong>
    </p>
    ${ctaButton("Open the manuscript", inviteUrl)}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${INK_MUTED};">
      If you didn&rsquo;t expect this invitation, you can safely ignore this email.
    </p>
  `.trim();

  const html = emailShell({
    productName,
    preheader: `${ownerName} invited you to ${projectName}`,
    bodyHtml,
    appUrl,
  });

  const text = [
    `${ownerName} invited you to collaborate on "${projectName}" on ${productName}.`,
    ``,
    `Your access: ${roleLabel}`,
    ``,
    `Open the manuscript: ${inviteUrl}`,
    ``,
    `If you didn't expect this invitation, you can safely ignore this email.`,
    ``,
    `— ${productName}`,
  ].join("\n");

  return { subject, html, text };
}

export interface ResetPasswordEmailParams {
  productName?: string;
  userName: string;
  resetUrl: string;
  appUrl: string;
}

export function renderResetPasswordEmail({
  productName = PRODUCT_NAME,
  userName,
  resetUrl,
  appUrl,
}: ResetPasswordEmailParams): { subject: string; html: string; text: string } {
  const safeName = escapeHtml(userName);

  const subject = `Reset your ${productName} password`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">
      Hi ${safeName},
    </p>
    <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${INK_MUTED};">
      We received a request to reset the password for your ${escapeHtml(productName)} account.
    </p>
    ${ctaButton("Reset password", resetUrl)}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:${INK_MUTED};">
      If you didn&rsquo;t request a password reset, you can safely ignore this email.
    </p>
  `.trim();

  const html = emailShell({
    productName,
    preheader: `Reset your ${productName} password`,
    bodyHtml,
    appUrl,
  });

  const text = [
    `Hi ${userName},`,
    ``,
    `We received a request to reset the password for your ${productName} account.`,
    ``,
    `Reset your password: ${resetUrl}`,
    ``,
    `If you didn't request a password reset, you can safely ignore this email.`,
    ``,
    `— ${productName}`,
  ].join("\n");

  return { subject, html, text };
}
