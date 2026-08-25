import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const ROOT = join(import.meta.dirname, "..");

const dbMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn();
  const from = vi.fn();
  const select = vi.fn();
  const orderBy = vi.fn();
  const innerJoin = vi.fn();

  return { limit, where, from, select, orderBy, innerJoin };
});

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: dbMocks.select,
  },
}));

import { getSession } from "@/lib/session";

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMocks.orderBy.mockResolvedValue([]);
    dbMocks.where.mockReturnValue({ orderBy: dbMocks.orderBy });
    dbMocks.innerJoin.mockReturnValue({ where: dbMocks.where, orderBy: dbMocks.orderBy });
    dbMocks.from.mockReturnValue({ where: dbMocks.where, innerJoin: dbMocks.innerJoin });
    dbMocks.select.mockReturnValue({ from: dbMocks.from });
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1", email: "ada@example.com", name: "Ada" },
    } as never);
  });

  it("does not import or call acceptPendingInvites", () => {
    const src = readFileSync(join(ROOT, "app/api/projects/route.ts"), "utf8");
    expect(src).not.toContain("acceptPendingInvites");
  });

  it("lists projects without auto-accepting invites", async () => {
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ owned: [], shared: [] });
  });
});
