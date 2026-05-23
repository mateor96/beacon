import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import type { FullConfig } from "@playwright/test";
import type { ValidatedReportTexts } from "../packages/ai/src/schemas.js";
import type { ScanCheck } from "../packages/shared/src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

export default async function globalSetup(_config: FullConfig) {
	// Clean stale auth state from previous runs
	const authDir = path.join(__dirname, ".auth");
	rmSync(authDir, { recursive: true, force: true });
	mkdirSync(authDir, { recursive: true });

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required for E2E tests");

	// Detect Playwright's Chromium and expose it for Puppeteer (PDF rendering)
	const chromiumPath = chromium.executablePath();
	process.env.CHROMIUM_PATH = chromiumPath;
	console.log(`[e2e:setup] CHROMIUM_PATH=${chromiumPath}`);

	// 1. Create test database if it doesn't exist
	const adminUrl = databaseUrl.replace(/\/[^/]+$/, "/postgres");
	const dbName = new URL(databaseUrl).pathname.slice(1);
	console.log(`[e2e:setup] Ensuring database "${dbName}" exists...`);

	const { default: postgres } = await import("postgres");
	const adminSql = postgres(adminUrl);
	try {
		const result = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
		if (result.length === 0) {
			await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
			console.log(`[e2e:setup] Created database "${dbName}"`);
		}
	} finally {
		await adminSql.end();
	}

	// 2. Run migrations
	console.log("[e2e:setup] Running migrations...");
	execSync("pnpm db:migrate:test", { cwd: ROOT, stdio: "inherit" });

	// 3. Seed RPC functions
	console.log("[e2e:setup] Seeding RPC functions...");
	execSync("pnpm db:seed-rpc:test", { cwd: ROOT, stdio: "inherit" });

	// 4. Truncate test tables
	console.log("[e2e:setup] Truncating test tables...");
	const testSql = postgres(databaseUrl);
	try {
		await testSql.unsafe("TRUNCATE scans, anonymous_scans, dead_letter_jobs CASCADE");
	} finally {
		await testSql.end();
	}

	// 5. Flush Redis
	console.log("[e2e:setup] Flushing Redis...");
	const { default: Redis } = await import("ioredis");
	const redis = new Redis({
		host: process.env.REDIS_HOST ?? "localhost",
		port: Number(process.env.REDIS_PORT ?? 6379),
		password: process.env.REDIS_PASSWORD,
	});
	await redis.flushdb();
	await redis.quit();

	// 6. Clean report files
	const reportPath = process.env.REPORT_STORAGE_PATH ?? "/tmp/beacon-test-reports";
	console.log(`[e2e:setup] Cleaning report files at ${reportPath}...`);
	rmSync(reportPath, { recursive: true, force: true });

	// 7. Ensure Supabase test user exists
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const testEmail = process.env.E2E_TEST_EMAIL;
	const testPassword = process.env.E2E_TEST_PASSWORD;

	if (!supabaseUrl || !serviceRoleKey || !testEmail || !testPassword) {
		throw new Error(
			"Supabase credentials and E2E_TEST_EMAIL/E2E_TEST_PASSWORD are required for E2E tests",
		);
	}

	const { createClient } = await import("@supabase/supabase-js");
	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});

	// Try to find existing user or create new one
	const { data: userList } = await supabase.auth.admin.listUsers();
	const existingUser = userList?.users?.find((u) => u.email === testEmail);

	let userId: string;
	if (existingUser) {
		userId = existingUser.id;
		console.log(`[e2e:setup] Test user exists: ${testEmail} (${userId})`);
	} else {
		const { data: newUser, error } = await supabase.auth.admin.createUser({
			email: testEmail,
			password: testPassword,
			email_confirm: true,
		});
		if (error) throw new Error(`Failed to create test user: ${error.message}`);
		userId = newUser.user.id;
		console.log(`[e2e:setup] Created test user: ${testEmail} (${userId})`);
	}

	// 8. Seed profile row with starter plan
	console.log("[e2e:setup] Seeding profile...");
	const dbSql = postgres(databaseUrl);
	try {
		await dbSql`
			INSERT INTO profiles (id, email, plan)
			VALUES (${userId}, ${testEmail}, 'starter')
			ON CONFLICT (id) DO UPDATE SET plan = 'starter', email = ${testEmail}
		`;

		// 9. Seed a completed scan owned by test user with pre-populated reportTexts
		const mockChecks: ScanCheck[] = [
			{
				id: "llms-txt",
				name: "llms.txt",
				category: "readability",
				status: "pass",
				score: 100,
				severity: "important",
				issues: [],
				summary: "llms.txt found",
			},
			{
				id: "robots-txt",
				name: "robots.txt",
				category: "readability",
				status: "pass",
				score: 100,
				severity: "important",
				issues: [],
				summary: "robots.txt found",
			},
			{
				id: "schema-org",
				name: "Schema.org",
				category: "readability",
				status: "warn",
				score: 50,
				severity: "important",
				issues: [{ message: "Missing Organization schema", severity: "important" }],
				summary: "Partial schema found",
			},
			{
				id: "content-structure",
				name: "Content Structure",
				category: "readability",
				status: "pass",
				score: 80,
				severity: "important",
				issues: [],
				summary: "Good structure",
			},
			{
				id: "performance",
				name: "Performance",
				category: "interactivity",
				status: "pass",
				score: 90,
				severity: "critical",
				issues: [],
				summary: "Good performance",
			},
			{
				id: "meta-tags",
				name: "Meta Tags",
				category: "readability",
				status: "pass",
				score: 100,
				severity: "important",
				issues: [],
				summary: "All meta tags present",
			},
			{
				id: "webmcp",
				name: "WebMCP",
				category: "interactivity",
				status: "fail",
				score: 0,
				severity: "nice-to-have",
				issues: [{ message: "No WebMCP endpoint found", severity: "nice-to-have" }],
				summary: "Not implemented",
			},
			{
				id: "agents-md",
				name: "agents.md",
				category: "interactivity",
				status: "fail",
				score: 0,
				severity: "nice-to-have",
				issues: [{ message: "No agents.md found", severity: "nice-to-have" }],
				summary: "Not found",
			},
			{
				id: "semantic-quality",
				name: "Semantic Quality",
				category: "transactional",
				status: "pass",
				score: 75,
				severity: "important",
				issues: [],
				summary: "Good semantic quality",
			},
			{
				id: "citation-readiness",
				name: "Citation Readiness",
				category: "transactional",
				status: "warn",
				score: 60,
				severity: "important",
				issues: [{ message: "Missing citation metadata", severity: "important" }],
				summary: "Partial citation readiness",
			},
		];

		const mockLevelScores = {
			readability: 82,
			interactivity: 45,
			transactional: 67,
		};

		const mockReportTexts: ValidatedReportTexts = {
			executiveSummary:
				"Die Website example.com erreicht einen Beacon-Score von 65/100 und befindet sich auf Stufe 2 (Interaktiv). Die Grundlagen sind solide, aber es gibt Verbesserungspotenzial bei der KI-Sichtbarkeit.",
			checkSummaries: {
				"llms-txt": {
					title: "llms.txt vorhanden",
					assessment: "Die llms.txt Datei ist korrekt konfiguriert.",
					recommendation: "Keine Aktion erforderlich.",
				},
				"robots-txt": {
					title: "robots.txt vorhanden",
					assessment: "Die robots.txt ist vorhanden und korrekt.",
					recommendation: "Keine Aktion erforderlich.",
				},
				"schema-org": {
					title: "Schema.org teilweise vorhanden",
					assessment: "Einige Schema.org Markierungen fehlen.",
					recommendation: "Organization Schema hinzufuegen.",
				},
				"content-structure": {
					title: "Gute Content-Struktur",
					assessment: "Die Seitenstruktur ist gut aufgebaut.",
					recommendation: "Ueberschriften-Hierarchie beibehalten.",
				},
				performance: {
					title: "Gute Performance",
					assessment: "Die Ladezeiten sind akzeptabel.",
					recommendation: "Bilder weiter optimieren.",
				},
				"meta-tags": {
					title: "Meta Tags vollstaendig",
					assessment: "Alle wichtigen Meta Tags sind vorhanden.",
					recommendation: "Keine Aktion erforderlich.",
				},
				webmcp: {
					title: "WebMCP nicht vorhanden",
					assessment: "Kein WebMCP Endpoint gefunden.",
					recommendation: "WebMCP Endpoint implementieren.",
				},
				"agents-md": {
					title: "agents.md nicht vorhanden",
					assessment: "Keine agents.md Datei gefunden.",
					recommendation: "agents.md Datei erstellen.",
				},
				"semantic-quality": {
					title: "Gute semantische Qualitaet",
					assessment: "Der Content ist semantisch gut aufbereitet.",
					recommendation: "Fachbegriffe weiter praezisieren.",
				},
				"citation-readiness": {
					title: "Zitierbarkeit verbesserungswuerdig",
					assessment: "Einige Zitier-Metadaten fehlen.",
					recommendation: "Citation Metadata ergaenzen.",
				},
			},
			categoryAssessments: {
				readability: {
					title: "Lesbarkeit",
					summary: "Die Grundlagen fuer KI-Lesbarkeit sind gut.",
					score: 82,
				},
				interactivity: {
					title: "Interaktivitaet",
					summary: "Verbesserungspotenzial bei KI-Interaktion.",
					score: 45,
				},
				transactional: {
					title: "Transaktionalitaet",
					summary: "Grundlegende transaktionale Faehigkeiten vorhanden.",
					score: 67,
				},
			},
			recommendations: [
				{
					priority: 1,
					title: "Schema.org erweitern",
					description: "Organization und WebSite Schema hinzufuegen fuer bessere KI-Erkennung.",
					impact: "high",
				},
				{
					priority: 2,
					title: "WebMCP Endpoint erstellen",
					description: "Einen WebMCP Endpoint bereitstellen fuer direkte KI-Interaktion.",
					impact: "medium",
				},
				{
					priority: 3,
					title: "agents.md erstellen",
					description: "Eine agents.md Datei mit KI-Agent-Anweisungen erstellen.",
					impact: "medium",
				},
			],
			conclusion:
				"Die Website hat eine solide Basis fuer KI-Sichtbarkeit. Mit den empfohlenen Massnahmen kann der Score deutlich verbessert werden.",
		};

		await dbSql`
			INSERT INTO scans (id, user_id, url, score, readiness_level, level_scores, checks, status, report_texts)
			VALUES (
				'e2e00000-0000-0000-0000-000000000001',
				${userId},
				'https://example.com',
				65,
				2,
				${JSON.stringify(mockLevelScores)}::jsonb,
				${JSON.stringify(mockChecks)}::jsonb,
				'completed',
				${JSON.stringify(mockReportTexts)}::jsonb
			)
			ON CONFLICT (id) DO UPDATE SET
				user_id = ${userId},
				url = 'https://example.com',
				score = 65,
				readiness_level = 2,
				level_scores = ${JSON.stringify(mockLevelScores)}::jsonb,
				checks = ${JSON.stringify(mockChecks)}::jsonb,
				status = 'completed',
				report_texts = ${JSON.stringify(mockReportTexts)}::jsonb,
				report_status = NULL,
				report_error = NULL,
				report_job_id = NULL,
				report_generated_at = NULL,
				report_file_size_bytes = NULL
		`;
		console.log("[e2e:setup] Seeded completed scan with reportTexts");
	} finally {
		await dbSql.end();
	}

	// 10. Store userId for teardown
	process.env.E2E_TEST_USER_ID = userId;

	console.log("[e2e:setup] Global setup complete");
}
