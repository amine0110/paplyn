"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { formatMemberRole } from "@/lib/project-sharing";

interface InvitePreview {
  id: string;
  role: "editor" | "viewer";
  accepted: boolean;
  projectId: string;
  projectName: string;
  projectUrl: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.id as string;

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInvite() {
      const res = await fetch(`/api/invite/${inviteId}`);
      if (!res.ok) {
        setError("This invite link is invalid or has expired.");
        setLoading(false);
        return;
      }
      setInvite(await res.json());
      setLoading(false);
    }
    loadInvite();
  }, [inviteId]);

  async function acceptInvite() {
    setAccepting(true);
    setError("");
    const res = await fetch(`/api/invite/${inviteId}`, { method: "POST" });
    if (res.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/invite/${inviteId}`)}`);
      return;
    }
    if (!res.ok) {
      const body = await res.json();
      setError(body.error || "Could not accept invite");
      setAccepting(false);
      return;
    }
    const result = await res.json();
    router.push(result.projectUrl.replace(/^https?:\/\/[^/]+/, "") || `/project/${result.projectId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-md mx-auto px-4 py-20 text-center text-ink-muted">Loading invite…</div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen">
        <Nav />
        <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
          <p className="text-error">{error || "Invite not found"}</p>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <div className="max-w-md mx-auto px-4 py-20 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-2xl font-semibold">Join manuscript</h1>
          <p className="text-ink-muted">
            You&apos;ve been invited to <span className="font-medium text-ink">{invite.projectName}</span>{" "}
            with <span className="font-medium text-ink">{formatMemberRole(invite.role)}</span> access.
          </p>
        </div>

        {error && <p className="text-sm text-error text-center">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button onClick={acceptInvite} disabled={accepting || invite.accepted} className="w-full">
            {accepting ? "Joining…" : invite.accepted ? "Already accepted" : "Accept invite"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Sign in with another account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
