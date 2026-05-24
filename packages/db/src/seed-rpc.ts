import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { INSTANCE_USER_ID } from "@beacon/shared";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlFile = readFileSync(path.resolve(__dirname, "../sql/rpc-functions.sql"), "utf-8");

const sql = postgres(process.env.DATABASE_URL);
await sql.unsafe(sqlFile);

// Sentinel profile for the single-tenant instance. Feature tables that still
// carry a NOT NULL userId FK (e.g. alerts) reference this id for operator-
// created rows. Idempotent.
await sql`
	INSERT INTO profiles (id, email, role)
	VALUES (${INSTANCE_USER_ID}, 'instance@beacon.local', 'admin')
	ON CONFLICT (id) DO NOTHING
`;

await sql.end();
console.log("RPC functions + instance profile seeded.");
