import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return { limit, where, from, select, returning, values, insert };
});

const sendPlicumEmail = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/project-access", () => ({
  getProjectAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbMocks.select,
    insert: dbMocks.insert,
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendPlicumEmail,
  formatEmailFailureReason: (result: { sent: false; reason: string; error?: string }) => {
    if (result.reason === "not-configured") {
      return "Email is not configured on this server (SMTP credentials missing).";
    }
    return result.error ? `Email could not be sent: ${result.error}` : "Email could not be sent.";
  },
}));

import { getSession } from "@/lib/session";
import { getProjectAccess } from "@/lib/project-access";

const projectId = "proj-1";
const ownerId = "owner-1";

const projectRow = {
  id: projectId,
  name: "Thesis",
  ownerId,
  mainFile: "main.tex",
  compiler: "pdflatex",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const inviteRow = {
  id: "invite-1",
  projectId,
  email: "guest@example.com",
  role: "editor" as const,
  invitedBy: ownerId,
  accepted: false,
  createdAt: new Date(),
};

const linkOnlyInviteRow = {
  ...inviteRow,
  id: "invite-link",
  email: null,
};

const existingUser = {
  id: "user-2",
  email: "member@example.com",
  name: "Member",
};

function mockOwnerSession() {
  vi.mocked(getSession).mockResolvedValue({
    user: { id: ownerId, email: "owner@example.com", name: "Owner" },
  } as never);
  vi.mocked(getProjectAccess).mockResolvedValue({
    project: projectRow,
    role: "owner",
    canEdit: true,
  } as never);
}

describe("POST /api/projects/[id]/invite", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMocks.returning.mockResolvedValue([inviteRow]);
    dbMocks.values.mockReturnValue({ returning: dbMocks.returning });
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
    dbMocks.limit.mockResolvedValue([]);
    sendPlicumEmail.mockResolvedValue({ sent: false, reason: "not-configured" });
  });

  it("returns invite link with explicit emailStatus when mailer is not configured", async () => {
    mockOwnerSession();

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guest@example.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.link).toContain("/invite/invite-1");
    expect(body.emailSent).toBe(false);
    expect(body.emailStatus).toBe("not-configured");
    expect(body.emailReason).toContain("SMTP credentials missing");
    expect(sendPlicumEmail).toHaveBeenCalled();
  });

  it("returns sent status when invite email succeeds", async () => {
    mockOwnerSession();
    sendPlicumEmail.mockResolvedValue({ sent: true });

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guest@example.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    const body = await res.json();
    expect(body.emailSent).toBe(true);
    expect(body.emailStatus).toBe("sent");
    expect(body.emailReason).toBeUndefined();
  });

  it("returns send-failed status when invite email fails", async () => {
    mockOwnerSession();
    sendPlicumEmail.mockResolvedValue({
      sent: false,
      reason: "send-failed",
      error: "Connection refused",
    });

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guest@example.com", role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.emailStatus).toBe("send-failed");
    expect(body.emailReason).toContain("Connection refused");
  });

  it("creates link-only invite with not-applicable status and no send", async () => {
    mockOwnerSession();
    dbMocks.returning.mockResolvedValue([linkOnlyInviteRow]);

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "editor", linkOnly: true }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.link).toContain("/invite/invite-link");
    expect(body.emailSent).toBe(false);
    expect(body.emailStatus).toBe("not-applicable");
    expect(sendPlicumEmail).not.toHaveBeenCalled();
  });

  it("returns already-member status without sending email", async () => {
    mockOwnerSession();
    dbMocks.limit
      .mockResolvedValueOnce([existingUser])
      .mockResolvedValueOnce([{ id: "member-1", projectId, userId: existingUser.id, role: "editor" }]);

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: existingUser.email, role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    const body = await res.json();
    expect(body.alreadyMember).toBe(true);
    expect(body.emailSent).toBe(false);
    expect(body.emailStatus).toBe("already-member");
    expect(sendPlicumEmail).not.toHaveBeenCalled();
  });

  it("creates pending invite for existing user and sends invite email", async () => {
    mockOwnerSession();
    dbMocks.limit.mockResolvedValueOnce([existingUser]).mockResolvedValueOnce([]);
    dbMocks.returning.mockResolvedValue([{ ...inviteRow, email: existingUser.email }]);
    sendPlicumEmail.mockResolvedValue({ sent: true });

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: existingUser.email, role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.link).toContain("/invite/");
    expect(body.emailSent).toBe(true);
    expect(body.emailStatus).toBe("sent");
    expect(body.added).toBeUndefined();
    expect(body.alreadyMember).toBeUndefined();
    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
    expect(sendPlicumEmail).toHaveBeenCalledTimes(1);
    expect(sendPlicumEmail.mock.calls[0]?.[0]?.subject).not.toContain("added you to Thesis");
  });

  it("creates pending invite for existing user even when email fails", async () => {
    mockOwnerSession();
    dbMocks.limit.mockResolvedValueOnce([existingUser]).mockResolvedValueOnce([]);
    dbMocks.returning.mockResolvedValue([{ ...inviteRow, email: existingUser.email }]);
    sendPlicumEmail.mockResolvedValue({
      sent: false,
      reason: "send-failed",
      error: "Connection refused",
    });

    const { POST } = await import("@/app/api/projects/[id]/invite/route");
    const res = await POST(
      new NextRequest(`http://localhost/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: existingUser.email, role: "editor" }),
      }),
      { params: Promise.resolve({ id: projectId }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.emailSent).toBe(false);
    expect(body.emailStatus).toBe("send-failed");
    expect(body.added).toBeUndefined();
    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
  });
});
