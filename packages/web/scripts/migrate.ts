import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { runDatabaseMigrations } from "../src/lib/db-migrate.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required for migrations.");
  process.exit(1);
}

const skipPush = process.env.SKIP_DB_PUSH === "1";
const skipSql = process.env.SKIP_SQL_MIGRATIONS === "1";

runDatabaseMigrations({
  databaseUrl,
  drizzleDir: join(rootDir, "drizzle"),
  cwd: rootDir,
  skipPush,
  skipSql,
})
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
