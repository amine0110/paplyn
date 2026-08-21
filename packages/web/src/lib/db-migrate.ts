import { execSync } from "child_process";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import postgres from "postgres";

const MIGRATION_TABLE = "_sql_migrations";

export interface SqlClient {
  unsafe: (query: string) => Promise<unknown>;
  end: (options?: { timeout?: number }) => Promise<void>;
}

export interface MigrationOptions {
  databaseUrl: string;
  drizzleDir: string;
  /** Working directory for drizzle-kit (contains drizzle.config.ts). */
  cwd: string;
  skipPush?: boolean;
  skipSql?: boolean;
  maxAttempts?: number;
  delayMs?: number;
}

/** Sort SQL migration files by numeric prefix (0000_, 0001_, …). */
export function sortMigrationFiles(filenames: string[]): string[] {
  return filenames
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => {
      const numA = parseInt(a.split("_")[0] ?? "0", 10);
      const numB = parseInt(b.split("_")[0] ?? "0", 10);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
}

export async function listSqlMigrationFiles(drizzleDir: string): Promise<string[]> {
  const entries = await readdir(drizzleDir);
  return sortMigrationFiles(entries);
}

export async function ensureMigrationTable(sql: SqlClient): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      name text PRIMARY KEY,
      applied_at timestamp DEFAULT now() NOT NULL
    )
  `);
}

export async function getAppliedMigrations(sql: SqlClient): Promise<Set<string>> {
  const rows = (await sql.unsafe(
    `SELECT name FROM ${MIGRATION_TABLE}`
  )) as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

export async function recordMigration(sql: SqlClient, name: string): Promise<void> {
  await sql.unsafe(`INSERT INTO ${MIGRATION_TABLE} (name) VALUES ($1)`, [name]);
}

export async function applySqlMigration(
  sql: SqlClient,
  name: string,
  content: string
): Promise<void> {
  await sql.unsafe(content);
  await recordMigration(sql, name);
}

export async function applyPendingSqlMigrations(
  sql: SqlClient,
  drizzleDir: string
): Promise<string[]> {
  await ensureMigrationTable(sql);
  const applied = await getAppliedMigrations(sql);
  const files = await listSqlMigrationFiles(drizzleDir);
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const content = await readFile(join(drizzleDir, file), "utf8");
    await applySqlMigration(sql, file, content);
    newlyApplied.push(file);
  }

  return newlyApplied;
}

export async function waitForDatabase(
  databaseUrl: string,
  maxAttempts = 30,
  delayMs = 2000
): Promise<SqlClient> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = postgres(databaseUrl, { max: 1, connect_timeout: 5 });
    try {
      await client`SELECT 1`;
      return client;
    } catch (error) {
      lastError = error;
      await client.end({ timeout: 1 }).catch(() => {});
      if (attempt < maxAttempts) {
        console.log(
          `Database not ready (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(
    `Database unreachable after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : lastError}`
  );
}

export function pushSchema(options: { cwd: string; databaseUrl: string }): void {
  const drizzleKit = join(options.cwd, "node_modules", ".bin", "drizzle-kit");
  execSync(`${drizzleKit} push --force`, {
    cwd: options.cwd,
    env: { ...process.env, DATABASE_URL: options.databaseUrl },
    stdio: "inherit",
  });
}

export async function runDatabaseMigrations(options: MigrationOptions): Promise<void> {
  const {
    databaseUrl,
    drizzleDir,
    cwd,
    skipPush = false,
    skipSql = false,
    maxAttempts = 30,
    delayMs = 2000,
  } = options;

  console.log("Waiting for database…");
  const sql = await waitForDatabase(databaseUrl, maxAttempts, delayMs);

  try {
    if (!skipPush) {
      console.log("Pushing schema via drizzle-kit…");
      pushSchema({ cwd, databaseUrl });
    }

    if (!skipSql) {
      console.log("Applying SQL migrations…");
      const applied = await applyPendingSqlMigrations(sql, drizzleDir);
      if (applied.length === 0) {
        console.log("No pending SQL migrations.");
      } else {
        console.log(`Applied SQL migrations: ${applied.join(", ")}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log("Database migrations complete.");
}
