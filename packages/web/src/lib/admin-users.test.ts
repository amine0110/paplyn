import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { serializeAdminUser, deleteUserForAdmin } from "@/lib/admin-users";
import { evaluateRequireAdmin } from "@/lib/session";

describe("serializeAdminUser", () => {
  it("returns safe fields only (no password or secrets)", () => {
    const row = {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      role: "admin",
      createdAt: new Date("2026-01-15T12:00:00.000Z"),
    };

    const summary = serializeAdminUser(row);

    expect(summary).toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada Lovelace",
      role: "admin",
      isAdmin: true,
      createdAt: "2026-01-15T12:00:00.000Z",
    });
    expect(summary).not.toHaveProperty("password");
    expect(summary).not.toHaveProperty("stripeCustomerId");
  });

  it("marks non-admin roles correctly", () => {
    const summary = serializeAdminUser({
      id: "user-2",
      email: "bob@example.com",
      name: "Bob",
      role: "user",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    expect(summary.isAdmin).toBe(false);
    expect(summary.role).toBe("user");
  });
});

describe("evaluateRequireAdmin", () => {
  it("returns 401 when there is no session", () => {
    expect(evaluateRequireAdmin(null)).toEqual({
      authorized: false,
      status: 401,
      error: "Unauthorized",
    });
  });

  it("returns 403 when the user is not an admin", () => {
    expect(
      evaluateRequireAdmin({
        user: { id: "u1", role: "user", email: "user@example.com", name: "User" },
      } as never)
    ).toEqual({
      authorized: false,
      status: 403,
      error: "Forbidden",
    });
  });

  it("returns the admin user when role is admin", () => {
    const adminUser = {
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
    };

    expect(evaluateRequireAdmin({ user: adminUser } as never)).toEqual({
      authorized: true,
      user: adminUser,
    });
  });
});

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 404 when admin panel is not available", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => false),
      listUsersForAdmin: vi.fn(),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(),
    }));

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Admin not available");
  });

  it("returns 401 when requireAdminApi rejects unauthenticated callers", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      listUsersForAdmin: vi.fn(),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: false,
        status: 401,
        error: "Unauthorized",
      })),
    }));

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when requireAdminApi rejects non-admin callers", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      listUsersForAdmin: vi.fn(),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: false,
        status: 403,
        error: "Forbidden",
      })),
    }));

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/users"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns user list for authorized admins", async () => {
    const users = [
      {
        id: "u1",
        email: "ada@example.com",
        name: "Ada",
        role: "admin",
        isAdmin: true,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const listUsersForAdmin = vi.fn(async (search?: string) => {
      expect(search).toBe("ada");
      return users;
    });

    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      listUsersForAdmin,
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: true,
        user: { id: "u1", role: "admin" },
      })),
    }));

    const { GET } = await import("@/app/api/admin/users/route");
    const res = await GET(new NextRequest("http://localhost/api/admin/users?search=ada"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ users });
    expect(listUsersForAdmin).toHaveBeenCalledWith("ada");
  });
});

describe("deleteUserForAdmin", () => {
  it("rejects deleting yourself", async () => {
    const result = await deleteUserForAdmin("admin-1", "admin-1");

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "You cannot remove your own account.",
    });
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 400 when admin tries to delete themselves", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      deleteUserForAdmin: vi.fn(async () => ({
        ok: false,
        status: 400,
        error: "You cannot remove your own account.",
      })),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: true,
        user: { id: "admin-1", role: "admin" },
      })),
    }));

    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/users/admin-1"),
      { params: Promise.resolve({ id: "admin-1" }) }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "You cannot remove your own account." });
  });

  it("returns 400 when deleting the last admin", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      deleteUserForAdmin: vi.fn(async () => ({
        ok: false,
        status: 400,
        error: "Cannot remove the last admin on this instance.",
      })),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: true,
        user: { id: "admin-2", role: "admin" },
      })),
    }));

    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/users/admin-1"),
      { params: Promise.resolve({ id: "admin-1" }) }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Cannot remove the last admin on this instance." });
  });

  it("returns ok when user is deleted", async () => {
    vi.doMock("@/lib/admin-users", () => ({
      isAdminPanelAvailable: vi.fn(async () => true),
      deleteUserForAdmin: vi.fn(async () => ({ ok: true })),
    }));
    vi.doMock("@/lib/session", () => ({
      requireAdminApi: vi.fn(async () => ({
        authorized: true,
        user: { id: "admin-1", role: "admin" },
      })),
    }));

    const { DELETE } = await import("@/app/api/admin/users/[id]/route");
    const res = await DELETE(
      new NextRequest("http://localhost/api/admin/users/user-2"),
      { params: Promise.resolve({ id: "user-2" }) }
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
