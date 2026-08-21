import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgresql://quire:quire@localhost:5432/quire";

const client = postgres(connectionString, { max: 10 });
export const db = drizzle(client, { schema });

export { schema };
