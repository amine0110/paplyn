import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sortMigrationFiles,
  listSqlMigrationFiles,
  ensureMigrationTable,
  getAppliedMigrations,
  applyPendingSqlMigrations,
  recordMigration,
  shouldRunDrizzlePush,
  drizzleKitAvailable,
  type SqlClient,
} from "./db-migrate";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("sortMigrationFiles", () => {
  it("sorts by numeric prefix", () => {
    const files = [
      "0002_invite_email_optional.sql",
      "0000_init.sql",
      "0001_collab_room.sql",
      "README.md",
    ];
    expect(sortMigrationFiles(files)).toEqual([
      "0000_init.sql",
      "0001_collab_room.sql",
      "0002_invite_email_optional.sql",
    ]);
  });

  it("ignores non-sql files", () => {
    expect(sortMigrationFiles(["meta.json", "0001_foo.sql"])).toEqual(["0001_foo.sql"]);
  });
});

describe("SQL migration runner", () => {
  let queries: string[];
  let applied: Set<string>;
  let client: SqlClient;

  beforeEach(() => {
    queries = [];
    applied = new Set();
    client = {
      unsafe: vi.fn(async (query: string, params?: unknown[]) => {
        queries.push(query);
        if (query.includes("SELECT name FROM")) {
          return [...applied].map((name) => ({ name }));
        }
        if (query.includes("INSERT INTO _sql_migrations")) {
          const name = params?.[0] as string;
          applied.add(name);
        }
        return [];
      }),
      end: vi.fn(async () => {}),
    };
  });

  it("creates migration tracking table", async () => {
    await ensureMigrationTable(client);
    expect(queries.some((q) => q.includes("CREATE TABLE IF NOT EXISTS _sql_migrations"))).toBe(
      true
    );
  });

  it("records applied migration names", async () => {
    await recordMigration(client, "0001_collab_room.sql");
    const names = await getAppliedMigrations(client);
    expect(names.has("0001_collab_room.sql")).toBe(true);
  });

  it("applies pending migrations in order and skips already applied", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drizzle-test-"));
    try {
      await writeFile(join(dir, "0001_collab_room.sql"), "CREATE TABLE collab_room;");
      await writeFile(join(dir, "0002_invite.sql"), "ALTER TABLE project_invite;");
      applied.add("0001_collab_room.sql");

      const newlyApplied = await applyPendingSqlMigrations(client, dir);

      expect(newlyApplied).toEqual(["0002_invite.sql"]);
      expect(queries.some((q) => q.includes("ALTER TABLE project_invite"))).toBe(true);
      expect(applied.has("0002_invite.sql")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("lists migration files from directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drizzle-list-"));
    try {
      await writeFile(join(dir, "0002_b.sql"), "-- b");
      await writeFile(join(dir, "0001_a.sql"), "-- a");
      await writeFile(join(dir, "notes.txt"), "ignore");

      const files = await listSqlMigrationFiles(dir);
      expect(files).toEqual(["0001_a.sql", "0002_b.sql"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("shouldRunDrizzlePush", () => {
  it("skips push when SKIP_DB_PUSH=1", () => {
    expect(
      shouldRunDrizzlePush({
        cwd: "/app",
        skipDbPush: "1",
        exists: () => true,
      })
    ).toBe(false);
  });

  it("skips push when drizzle-kit is missing", () => {
    expect(
      shouldRunDrizzlePush({
        cwd: "/app",
        exists: () => false,
      })
    ).toBe(false);
  });

  it("runs push only when SKIP_DB_PUSH is unset and drizzle-kit exists", () => {
    expect(
      shouldRunDrizzlePush({
        cwd: "/app",
        exists: (path) => path.endsWith("drizzle-kit"),
      })
    ).toBe(true);
  });
});

describe("drizzleKitAvailable", () => {
  it("checks the drizzle-kit binary path under node_modules", () => {
    const cwd = "/app";
    const seen: string[] = [];
    drizzleKitAvailable(cwd, (path) => {
      seen.push(path);
      return path === "/app/node_modules/.bin/drizzle-kit";
    });
    expect(seen).toEqual(["/app/node_modules/.bin/drizzle-kit"]);
  });
});

describe("migration SQL files", () => {
  it("uses additive patterns in checked-in migrations", async () => {
    const { readFile, readdir } = await import("fs/promises");
    const { join } = await import("path");
    const drizzleDir = join(__dirname, "../../drizzle");
    const files = sortMigrationFiles(await readdir(drizzleDir));

    expect(files.length).toBeGreaterThanOrEqual(3);

    const init = await readFile(join(drizzleDir, "0000_init.sql"), "utf8");
    expect(init).not.toContain("CREATE TYPE IF NOT EXISTS");
    expect(init).toContain("WHEN duplicate_object THEN NULL");
    expect(init).toContain("ADD COLUMN IF NOT EXISTS");
    expect(init).toContain("CREATE UNIQUE INDEX IF NOT EXISTS");

    const collab = await readFile(join(drizzleDir, "0001_collab_room.sql"), "utf8");
    expect(collab).toContain("CREATE TABLE IF NOT EXISTS collab_room");

    const invite = await readFile(join(drizzleDir, "0002_invite_email_optional.sql"), "utf8");
    expect(invite).toContain("DROP NOT NULL");
  });

  it("0000_init.sql enum creation is valid on PostgreSQL 16 (no CREATE TYPE IF NOT EXISTS)", async () => {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const init = await readFile(join(__dirname, "../../drizzle/0000_init.sql"), "utf8");

    expect(init.match(/DO \$\$ BEGIN/g)?.length).toBe(3);
    expect(init).toContain("CREATE TYPE plan AS ENUM");
    expect(init).toContain("CREATE TYPE member_role AS ENUM");
    expect(init).toContain("CREATE TYPE invite_role AS ENUM");
    expect(init).toContain("WHEN duplicate_object THEN NULL");
  });
});
