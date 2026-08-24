"use client";

import { useEffect, useState } from "react";
import { Users, Link2, Copy, Check, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildInviteUrl,
  buildProjectUrl,
  copyTextToClipboard,
  formatMemberRole,
  type InviteRole,
} from "@/lib/project-sharing";
import { PRODUCT } from "@/lib/product";
import { resolveInviteEmailNotice } from "@/lib/invite-email-notice";

interface ShareMember {
  id: string;
  role: "owner" | "editor" | "viewer";
  userId: string;
  name: string;
  email: string;
}

interface ShareOwner {
  id: string;
  name: string;
  email: string;
}

interface PendingInvite {
  id: string;
  email: string | null;
  role: InviteRole;
  link: string;
}

interface ShareDialogProps {
  open: boolean;
  projectId: string;
  projectName: string;
  canManage: boolean;
  onClose: () => void;
}

export function ShareDialog({
  open,
  projectId,
  projectName,
  canManage,
  onClose,
}: ShareDialogProps) {
  const [members, setMembers] = useState<ShareMember[]>([]);
  const [owner, setOwner] = useState<ShareOwner | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [shareRole, setShareRole] = useState<InviteRole>("editor");
  const [shareEmail, setShareEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"project" | "invite" | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{ notice: "sent" | "not-sent"; message: string } | null>(null);
  const [error, setError] = useState("");

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const projectLink = appOrigin ? buildProjectUrl(appOrigin, projectId) : "";

  useEffect(() => {
    if (!open) return;

    async function loadSharing() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/projects/${projectId}/invite`);
      if (!res.ok) {
        setError("Could not load sharing details");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMembers(data.members ?? []);
      setOwner(data.owner ?? null);
      setInvites(data.invites ?? []);
      setLoading(false);
    }

    loadSharing();
  }, [open, projectId]);

  async function copyProjectLink() {
    if (!projectLink) return;
    const ok = await copyTextToClipboard(projectLink);
    if (ok) {
      setCopied("project");
      setTimeout(() => setCopied(null), 2000);
    }
  }

  async function copyInviteLink(link: string) {
    const ok = await copyTextToClipboard(link);
    if (ok) {
      setInviteLink(link);
      setCopied("invite");
      setTimeout(() => setCopied(null), 2000);
    }
  }

  async function createInviteLink(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;

    setCreating(true);
    setError("");
    setInviteNotice(null);

    const hadEmail = Boolean(shareEmail.trim());
    const body = shareEmail.trim()
      ? { email: shareEmail.trim(), role: shareRole }
      : { role: shareRole, linkOnly: true };

    const res = await fetch(`/api/projects/${projectId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setCreating(false);

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === "string" ? err.error : "Failed to create invite");
      return;
    }

    const invite = await res.json();
    const link = invite.link || (appOrigin ? buildInviteUrl(appOrigin, invite.id) : "");
    setInviteLink(link);
    setInvites((prev) => [{ id: invite.id, email: invite.email, role: invite.role, link }, ...prev]);
    setShareEmail("");

    if (hadEmail) {
      setInviteNotice(resolveInviteEmailNotice(invite.emailSent, invite.emailReason));
    } else {
      await copyInviteLink(link);
    }
  }

  async function removeMember(memberId: string) {
    if (!canManage) return;

    setRemovingMemberId(memberId);
    setError("");

    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });

    setRemovingMemberId(null);

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === "string" ? err.error : "Failed to remove member");
      return;
    }

    setMembers((prev) => prev.filter((member) => member.id !== memberId));
  }

  async function revokeInvite(inviteId: string) {
    if (!canManage) return;

    setRevokingInviteId(inviteId);
    setError("");

    const res = await fetch(`/api/projects/${projectId}/invites/${inviteId}`, {
      method: "DELETE",
    });

    setRevokingInviteId(null);

    if (!res.ok) {
      const err = await res.json();
      setError(typeof err.error === "string" ? err.error : "Failed to revoke invite");
      return;
    }

    setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
    if (inviteLink && invites.find((invite) => invite.id === inviteId)?.link === inviteLink) {
      setInviteLink("");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 p-4">
      <div className="bg-paper rounded-lg border border-border p-6 w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-accent" />
          <h2 className="font-serif text-xl font-semibold">Share manuscript</h2>
        </div>
        <p className="text-sm text-ink-muted mb-5">{projectName}</p>

        {error && <p className="text-sm text-error mb-4">{error}</p>}

        <div className="space-y-5">
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-ink-faint">Project link</Label>
            <div className="flex gap-2">
              <Input readOnly value={projectLink} className="font-mono text-xs" />
              <Button type="button" variant="secondary" size="sm" onClick={copyProjectLink}>
                {copied === "project" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline ml-1">{copied === "project" ? "Copied" : "Copy"}</span>
              </Button>
            </div>
            <p className="text-xs text-ink-faint">
              People with access can open this manuscript directly. New collaborators still need an invite link.
            </p>
          </section>

          {canManage && (
            <section className="space-y-3 border-t border-border-light pt-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-medium">Invite link</h3>
              </div>
              <form onSubmit={createInviteLink} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="share-role">Permission</Label>
                  <select
                    id="share-role"
                    value={shareRole}
                    onChange={(e) => setShareRole(e.target.value as InviteRole)}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm bg-paper text-ink"
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="share-email">Email (optional)</Label>
                  <Input
                    id="share-email"
                    type="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder={PRODUCT.emails.invitePlaceholder}
                  />
                  <p className="text-xs text-ink-faint">
                    We&rsquo;ll email an invite link. Leave blank to copy a link-only invite instead.
                  </p>
                </div>
                {inviteNotice && (
                  <p
                    className={`text-sm ${inviteNotice.notice === "sent" ? "text-accent" : "text-ink-muted"}`}
                    role="status"
                  >
                    {inviteNotice.message}
                  </p>
                )}
                {inviteLink && (
                  <div className="flex gap-2">
                    <Input readOnly value={inviteLink} className="font-mono text-xs" />
                    <Button type="button" variant="secondary" size="sm" onClick={() => copyInviteLink(inviteLink)}>
                      {copied === "invite" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}
                <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                  <Link2 className="h-3.5 w-3.5" />
                  {creating ? "Creating…" : shareEmail.trim() ? "Send invite" : "Copy invite link"}
                </Button>
              </form>
            </section>
          )}

          <section className="space-y-2 border-t border-border-light pt-5">
            <h3 className="text-sm font-medium">People with access</h3>
            {loading ? (
              <p className="text-sm text-ink-faint">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {owner && (
                  <li className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{owner.name}</p>
                      <p className="truncate text-xs text-ink-faint">{owner.email}</p>
                    </div>
                    <span className="text-xs text-ink-faint shrink-0 ml-2">{formatMemberRole("owner")}</span>
                  </li>
                )}
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.name}</p>
                      <p className="truncate text-xs text-ink-faint">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-xs text-ink-faint">
                        {formatMemberRole(member.role)}
                      </span>
                      {canManage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-1.5 text-ink-faint hover:text-error"
                          onClick={() => removeMember(member.id)}
                          disabled={removingMemberId === member.id}
                          title="Remove member"
                        >
                          {removingMemberId === member.id ? (
                            <span className="text-xs">…</span>
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage && invites.length > 0 && (
            <section className="space-y-2 border-t border-border-light pt-5">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-ink-faint" />
                <h3 className="text-sm font-medium">Pending invites</h3>
              </div>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{invite.email || "Link invite"}</p>
                      <p className="text-xs text-ink-faint">{formatMemberRole(invite.role)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="sm" onClick={() => copyInviteLink(invite.link)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-ink-faint hover:text-error"
                        onClick={() => revokeInvite(invite.id)}
                        disabled={revokingInviteId === invite.id}
                        title="Revoke invite"
                      >
                        {revokingInviteId === invite.id ? (
                          <span className="text-xs">…</span>
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
