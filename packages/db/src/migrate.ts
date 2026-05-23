import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}
const connectionString = process.env.DATABASE_URL;

// Single connection for migrations (not pooled)
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function runMigrations() {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations complete.");
	await sql.end();
}

runMigrations().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
