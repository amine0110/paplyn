import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const deleteWhere = vi.fn();
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  return { limit, where, from, select, deleteWhere, deleteFn };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: dbMocks.select,
    delete: dbMocks.deleteFn,
  },
}));

import { removeProjectMember, revokeProjectInvite } from "@/lib/project-access";

const projectId = "proj-1";
const ownerId = "owner-1";
const editorId = "editor-1";
const memberRowId = "member-row-1";
const inviteId = "invite-1";

const projectRow = {
  id: projectId,
  ownerId,
  name: "Test",
  mainFile: "main.tex",
  compiler: "pdflatex",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const memberRow = {
  id: memberRowId,
  projectId,
  userId: editorId,
  role: "editor" as const,
  createdAt: new Date(),
};

const inviteRow = {
  id: inviteId,
  projectId,
  email: "guest@example.com",
  role: "editor" as const,
  invitedBy: ownerId,
  accepted: false,
  createdAt: new Date(),
};

function mockProjectAccessAsOwner() {
  dbMocks.limit.mockResolvedValueOnce([projectRow]);
}

function mockProjectAccessAsEditor() {
  dbMocks.limit
    .mockResolvedValueOnce([projectRow])
    .mockResolvedValueOnce([{ ...memberRow, userId: editorId }]);
}

function mockProjectAccessDenied() {
  dbMocks.limit.mockResolvedValueOnce([projectRow]).mockResolvedValueOnce([]);
}

describe("removeProjectMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner to remove a member", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([memberRow]);
    dbMocks.deleteWhere.mockResolvedValue(undefined);

    const result = await removeProjectMember(projectId, ownerId, memberRowId);

    expect(result).toEqual({ ok: true });
    expect(dbMocks.deleteFn).toHaveBeenCalled();
  });

  it("forbids non-owners", async () => {
    mockProjectAccessAsEditor();

    const result = await removeProjectMember(projectId, editorId, memberRowId);

    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
    expect(dbMocks.deleteFn).not.toHaveBeenCalled();
  });

  it("returns not found when the actor has no access", async () => {
    mockProjectAccessDenied();

    const result = await removeProjectMember(projectId, "stranger", memberRowId);

    expect(result).toEqual({ ok: false, status: 404, error: "Not found" });
  });

  it("cannot remove yourself", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([{ ...memberRow, userId: ownerId }]);

    const result = await removeProjectMember(projectId, ownerId, memberRowId);

    expect(result).toEqual({ ok: false, status: 400, error: "Cannot remove yourself" });
    expect(dbMocks.deleteFn).not.toHaveBeenCalled();
  });

  it("returns not found when the member row is missing", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([]);

    const result = await removeProjectMember(projectId, ownerId, memberRowId);

    expect(result).toEqual({ ok: false, status: 404, error: "Not found" });
    expect(dbMocks.deleteFn).not.toHaveBeenCalled();
  });
});

describe("revokeProjectInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows the owner to revoke a pending invite", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([inviteRow]);
    dbMocks.deleteWhere.mockResolvedValue(undefined);

    const result = await revokeProjectInvite(projectId, ownerId, inviteId);

    expect(result).toEqual({ ok: true });
    expect(dbMocks.deleteFn).toHaveBeenCalled();
  });

  it("forbids non-owners", async () => {
    mockProjectAccessAsEditor();

    const result = await revokeProjectInvite(projectId, editorId, inviteId);

    expect(result).toEqual({ ok: false, status: 403, error: "Forbidden" });
    expect(dbMocks.deleteFn).not.toHaveBeenCalled();
  });

  it("rejects already accepted invites", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([{ ...inviteRow, accepted: true }]);

    const result = await revokeProjectInvite(projectId, ownerId, inviteId);

    expect(result).toEqual({ ok: false, status: 400, error: "Invite already accepted" });
    expect(dbMocks.deleteFn).not.toHaveBeenCalled();
  });

  it("returns not found for missing invites", async () => {
    mockProjectAccessAsOwner();
    dbMocks.limit.mockResolvedValueOnce([]);

    const result = await revokeProjectInvite(projectId, ownerId, "missing");

    expect(result).toEqual({ ok: false, status: 404, error: "Not found" });
  });
});
