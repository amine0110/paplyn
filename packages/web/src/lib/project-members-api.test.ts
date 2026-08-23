import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const removeProjectMember = vi.fn();
const revokeProjectInvite = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/project-access", () => ({
  removeProjectMember,
  revokeProjectInvite,
}));

import { getSession } from "@/lib/session";

describe("DELETE /api/projects/[id]/members/[memberId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/projects/[id]/members/[memberId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/members/m1"),
      { params: Promise.resolve({ id: "proj-1", memberId: "m1" }) }
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns mutation errors from removeProjectMember", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "owner-1", email: "owner@example.com", name: "Owner" },
    } as never);
    removeProjectMember.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });

    const { DELETE } = await import("@/app/api/projects/[id]/members/[memberId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/members/m1"),
      { params: Promise.resolve({ id: "proj-1", memberId: "m1" }) }
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
    expect(removeProjectMember).toHaveBeenCalledWith("proj-1", "owner-1", "m1");
  });

  it("returns success when the owner removes a member", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "owner-1", email: "owner@example.com", name: "Owner" },
    } as never);
    removeProjectMember.mockResolvedValue({ ok: true });

    const { DELETE } = await import("@/app/api/projects/[id]/members/[memberId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/members/m1"),
      { params: Promise.resolve({ id: "proj-1", memberId: "m1" }) }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});

describe("DELETE /api/projects/[id]/invites/[inviteId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/projects/[id]/invites/[inviteId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/invites/inv-1"),
      { params: Promise.resolve({ id: "proj-1", inviteId: "inv-1" }) }
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns mutation errors from revokeProjectInvite", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "owner-1", email: "owner@example.com", name: "Owner" },
    } as never);
    revokeProjectInvite.mockResolvedValue({
      ok: false,
      status: 400,
      error: "Invite already accepted",
    });

    const { DELETE } = await import("@/app/api/projects/[id]/invites/[inviteId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/invites/inv-1"),
      { params: Promise.resolve({ id: "proj-1", inviteId: "inv-1" }) }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invite already accepted" });
  });

  it("returns success when the owner revokes an invite", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "owner-1", email: "owner@example.com", name: "Owner" },
    } as never);
    revokeProjectInvite.mockResolvedValue({ ok: true });

    const { DELETE } = await import("@/app/api/projects/[id]/invites/[inviteId]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/projects/proj-1/invites/inv-1"),
      { params: Promise.resolve({ id: "proj-1", inviteId: "inv-1" }) }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
});
