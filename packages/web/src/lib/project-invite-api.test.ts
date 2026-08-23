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

  it("returns invite link when mailer is not configured", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: ownerId, email: "owner@example.com", name: "Owner" },
    } as never);
    vi.mocked(getProjectAccess).mockResolvedValue({
      project: projectRow,
      role: "owner",
      canEdit: true,
    } as never);

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
    expect(sendPlicumEmail).toHaveBeenCalled();
  });
});
