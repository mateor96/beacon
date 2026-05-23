import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// DATABASE_URL is required for any actual query, but we resolve it lazily so
// build-time module evaluation (Next.js "Collecting page data") doesn't fail
// when env vars haven't been provided. The placeholder is never used —
// postgres-js connects on first query, which is where the real error surfaces
// (with the message below).
const connectionString =
	process.env.DATABASE_URL ?? "postgres://_:_@127.0.0.1:5432/_no_database_url_set_";

if (!process.env.DATABASE_URL) {
	console.warn("[@beacon/db] DATABASE_URL is not set. Queries will fail until it is configured.");
}

const sql = postgres(connectionString, { max: 10 });

export const db = drizzle(sql, { schema });

export type Database = typeof db;

export type Transaction = PgTransaction<
	PostgresJsQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;

export type DbClient = Database | Transaction;

export async function pingDb(): Promise<boolean> {
	try {
		await sql`SELECT 1`;
		return true;
	} catch {
		return false;
	}
}
