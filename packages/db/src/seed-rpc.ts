import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlFile = readFileSync(path.resolve(__dirname, "../sql/rpc-functions.sql"), "utf-8");

const sql = postgres(process.env.DATABASE_URL);
await sql.unsafe(sqlFile);
await sql.end();
console.log("RPC functions seeded.");
