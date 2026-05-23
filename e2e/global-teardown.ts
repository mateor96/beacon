import type { FullConfig } from "@playwright/test";

export default async function globalTeardown(_config: FullConfig) {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) return;

	console.log("[e2e:teardown] Truncating test tables...");
	const { default: postgres } = await import("postgres");
	const sql = postgres(databaseUrl);
	try {
		await sql.unsafe("TRUNCATE scans, anonymous_scans, dead_letter_jobs CASCADE");
		console.log("[e2e:teardown] Cleanup complete");
	} finally {
		await sql.end();
	}
}
