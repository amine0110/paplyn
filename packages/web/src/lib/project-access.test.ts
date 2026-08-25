import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const deleteWhere = vi.fn();
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));
  const set = vi.fn();
  const updateWhere = vi.fn();
  const update = vi.fn(() => ({ set, where: updateWhere }));
  const values = vi.fn();
  const insert = vi.fn(() => ({ values }));

  return { limit, where, from, select, deleteWhere, deleteFn, set, updateWhere, update, values, insert };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: dbMocks.select,
    delete: dbMocks.deleteFn,
    insert: dbMocks.insert,
    update: dbMocks.update,
  },
}));

import { removeProjectMember, revokeProjectInvite, acceptInviteForUser } from "@/lib/project-access";

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

const acceptingUser = {
  id: "user-accept",
  email: "guest@example.com",
  name: "Guest",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
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

describe("acceptInviteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.set.mockReturnValue({ where: dbMocks.updateWhere });
    dbMocks.updateWhere.mockResolvedValue(undefined);
    dbMocks.values.mockResolvedValue(undefined);
    dbMocks.insert.mockReturnValue({ values: dbMocks.values });
  });

  it("adds membership only when the invite is explicitly accepted", async () => {
    dbMocks.limit
      .mockResolvedValueOnce([inviteRow])
      .mockResolvedValueOnce([projectRow])
      .mockResolvedValueOnce([]);

    const result = await acceptInviteForUser(inviteId, acceptingUser);

    expect(result).toEqual({ ok: true, projectId, alreadyMember: false });
    expect(dbMocks.insert).toHaveBeenCalledTimes(1);
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
  });

  it("does not insert membership when the user is already a member", async () => {
    dbMocks.limit
      .mockResolvedValueOnce([inviteRow])
      .mockResolvedValueOnce([projectRow])
      .mockResolvedValueOnce([memberRow]);

    const result = await acceptInviteForUser(inviteId, acceptingUser);

    expect(result).toEqual({ ok: true, projectId, alreadyMember: true });
    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
  });
});
