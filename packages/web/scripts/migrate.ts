import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { runDatabaseMigrations, shouldRunDrizzlePush } from "../src/lib/db-migrate";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required for migrations.");
  process.exit(1);
}

// Production default: SQL migrations only (entrypoint sets SKIP_DB_PUSH=1).
// Optional drizzle-kit push when SKIP_DB_PUSH is unset and drizzle-kit exists.
const skipPush = !shouldRunDrizzlePush({
  cwd: rootDir,
  skipDbPush: process.env.SKIP_DB_PUSH,
});
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
