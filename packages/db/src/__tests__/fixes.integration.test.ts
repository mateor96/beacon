/**
 * Integration tests for the fix-generation schema (#223).
 *
 * Verifies behavior that mock-based unit tests cannot cover:
 *   - FK CASCADE / RESTRICT / SET NULL enforcement at the DB level
 *   - Partial unique index for monotonic versioning under soft-delete
 *   - Encryption round-trip across the createCmsConnection boundary
 *   - AAD binding to row identity (tamper detection)
 *   - DSGVO deletion sweeper survives the RESTRICT chain (P1.1 regression)
 *
 * Requires DATABASE_URL pointing to a Postgres instance with migrations
 * applied. Skips gracefully when DATABASE_URL is not set.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	__resetKeyCacheForTests,
	cmsCredentialsAad,
	decryptCmsCredentials,
} from "@beacon/shared/crypto-aes-gcm";
import type { CmsCredentialsPlaintext } from "@beacon/shared/types";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../client.js";
import {
	createCmsConnection,
	createDeploymentAttempt,
	createGeneratedFix,
	getDecryptedCmsConnection,
	listFixesByScan,
	recordValidation,
	softDeleteCmsConnection,
	softDeleteFix,
	updateDeploymentStatus,
} from "../queries/fixes.js";
import {
	cmsConnections,
	deploymentAttempts,
	fixValidations,
	generatedFixes,
} from "../schema/fixes.js";
import * as schema from "../schema/index.js";
import { profiles } from "../schema/profiles.js";
import { scans } from "../schema/scans.js";

const DATABASE_URL = process.env.DATABASE_URL;
const TEST_KEY = Buffer.from("a".repeat(32)).toString("base64");

describe.skipIf(!DATABASE_URL)("fix generation schema (real Postgres)", () => {
	let sqlClient: ReturnType<typeof postgres>;
	let db: Database;

	beforeAll(async () => {
		const url = DATABASE_URL as string;
		sqlClient = postgres(url, { max: 5 });
		db = drizzle(sqlClient, { schema }) as unknown as Database;

		const dirname = path.dirname(fileURLToPath(import.meta.url));
		const migrationsFolder = path.resolve(dirname, "../../drizzle");
		const migrationClient = postgres(url, { max: 1 });
		await migrate(drizzle(migrationClient), { migrationsFolder });
		await migrationClient.end();
	});

	afterAll(async () => {
		await sqlClient.end();
	});

	beforeEach(() => {
		process.env.CMS_CREDENTIALS_KEY = TEST_KEY;
		__resetKeyCacheForTests();
	});

	afterEach(async () => {
		await sqlClient`TRUNCATE profiles, scans, cms_connections, generated_fixes, deployment_attempts, fix_validations CASCADE`;
		__resetKeyCacheForTests();
	});

	const USER_ID = "00000000-0000-4000-a000-000000000001";

	async function seedUser(): Promise<void> {
		await db.insert(profiles).values({
			id: USER_ID,
			email: "fix-test@example.com",
			plan: "pro",
		});
	}

	async function seedScan(): Promise<string> {
		const [row] = await db
			.insert(scans)
			.values({
				userId: USER_ID,
				url: "https://example.com",
				score: 75,
				readinessLevel: 1,
				levelScores: { readability: 80, interactivity: 60, transactional: 0 },
				checks: [],
				status: "completed",
			})
			.returning({ id: scans.id });
		return row.id;
	}

	const SAMPLE_CREDS: CmsCredentialsPlaintext = {
		cms: "wordpress",
		baseUrl: "https://example.com",
		username: "admin",
		appPassword: "abcd 1234 efgh 5678",
	};

	// ── Schema sanity ───────────────────────────────────────────────────

	it("migrates the four new tables and named indexes", async () => {
		const tables = await sqlClient<{ tablename: string }[]>`
			SELECT tablename FROM pg_tables
			WHERE schemaname = 'public'
			AND tablename IN ('generated_fixes', 'cms_connections', 'deployment_attempts', 'fix_validations')
			ORDER BY tablename`;
		expect(tables.map((t) => t.tablename)).toEqual([
			"cms_connections",
			"deployment_attempts",
			"fix_validations",
			"generated_fixes",
		]);

		const indexes = await sqlClient<{ indexname: string }[]>`
			SELECT indexname FROM pg_indexes
			WHERE schemaname = 'public'
			AND indexname IN (
				'uq_generated_fixes_scan_type_version',
				'idx_generated_fixes_scan',
				'idx_generated_fixes_user',
				'idx_generated_fixes_fix_type',
				'idx_generated_fixes_status',
				'idx_cms_connections_user_active',
				'idx_deployment_attempts_fix',
				'idx_fix_validations_deployment'
			)`;
		expect(indexes.length).toBe(8);
	});

	// ── Versioning + soft-delete partial index ──────────────────────────

	it("creates monotonic versions per (scan_id, fix_type)", async () => {
		await seedUser();
		const scanId = await seedScan();

		const versions: number[] = [];
		for (let i = 0; i < 5; i++) {
			const { version } = await createGeneratedFix(db, {
				scanId,
				userId: USER_ID,
				fixType: "llms_txt",
				content: `# llms.txt v${i + 1}`,
				contentHash: `hash-${i + 1}`,
			});
			versions.push(version);
		}
		expect(versions).toEqual([1, 2, 3, 4, 5]);
	});

	it("soft-deleted rows do not block reuse of (scan_id, fix_type, version) on the partial unique index", async () => {
		await seedUser();
		const scanId = await seedScan();

		const first = await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "json_ld",
			content: "{}",
			contentHash: "hash-a",
		});
		expect(first.version).toBe(1);

		await softDeleteFix(db, first.id);

		// After soft-delete, MAX(version) on active rows is 0, so the next
		// insert must produce version 1 again — which would collide if the
		// unique index were not partial. The fact that this succeeds proves
		// the partial WHERE clause is in effect.
		const second = await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "json_ld",
			content: "{}",
			contentHash: "hash-b",
		});
		expect(second.version).toBe(1);
		expect(second.id).not.toBe(first.id);
	});

	// ── CASCADE / RESTRICT / SET NULL FK behavior ───────────────────────

	it("CASCADE deletes generated_fixes when scan is deleted", async () => {
		await seedUser();
		const scanId = await seedScan();
		await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "agents_md",
			content: "agents",
			contentHash: "h",
		});

		await db.delete(scans).where(eq(scans.id, scanId));

		const remaining = await db
			.select()
			.from(generatedFixes)
			.where(eq(generatedFixes.scanId, scanId));
		expect(remaining).toHaveLength(0);
	});

	it("RESTRICT prevents hard-delete of cms_connection while deployment_attempts reference it", async () => {
		await seedUser();
		const scanId = await seedScan();
		const fix = await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "llms_txt",
			content: "x",
			contentHash: "h",
		});
		const conn = await createCmsConnection(db, {
			userId: USER_ID,
			cmsType: "wordpress",
			siteUrl: "https://example.com",
			credentials: SAMPLE_CREDS,
		});
		await createDeploymentAttempt(db, {
			fixId: fix.id,
			cmsConnectionId: conn.id,
		});

		await expect(db.delete(cmsConnections).where(eq(cmsConnections.id, conn.id))).rejects.toThrow(
			/violates foreign key constraint/i,
		);

		// Soft-delete still succeeds (and wipes the credential blob).
		await softDeleteCmsConnection(db, conn.id);
		const [row] = await db.select().from(cmsConnections).where(eq(cmsConnections.id, conn.id));
		expect(row.deletedAt).not.toBeNull();
		expect(row.isActive).toBe(false);
		expect(row.encryptedCredentials).toBeNull();
	});

	it("SET NULL on fix_validations.scan_id when the post-deploy re-scan is deleted", async () => {
		await seedUser();
		const originalScan = await seedScan();
		const fix = await createGeneratedFix(db, {
			scanId: originalScan,
			userId: USER_ID,
			fixType: "llms_txt",
			content: "x",
			contentHash: "h",
		});
		const conn = await createCmsConnection(db, {
			userId: USER_ID,
			cmsType: "webflow",
			siteUrl: "https://example.com",
			credentials: { cms: "webflow", siteId: "s", apiToken: "t" },
		});
		const deployment = await createDeploymentAttempt(db, {
			fixId: fix.id,
			cmsConnectionId: conn.id,
		});

		// The post-deploy re-scan is a NEW scan row (D17 semantic).
		const [rescan] = await db
			.insert(scans)
			.values({
				userId: USER_ID,
				url: "https://example.com",
				score: 80,
				readinessLevel: 2,
				levelScores: { readability: 90, interactivity: 70, transactional: 0 },
				checks: [],
				status: "completed",
			})
			.returning({ id: scans.id });

		const validation = await recordValidation(db, {
			deploymentId: deployment.id,
			scanId: rescan.id,
			status: "pass",
			results: { checksRun: ["llms-txt"], checksPassed: ["llms-txt"], checksFailed: [] },
		});

		// Drop the re-scan; the validation row must survive with scan_id = NULL.
		await db.delete(scans).where(eq(scans.id, rescan.id));
		const [survivor] = await db
			.select()
			.from(fixValidations)
			.where(eq(fixValidations.id, validation.id));
		expect(survivor).toBeDefined();
		expect(survivor.scanId).toBeNull();
		expect(survivor.status).toBe("pass");
	});

	// ── Encryption round-trip and AAD binding ───────────────────────────

	it("createCmsConnection + getDecryptedCmsConnection round-trip the credential payload", async () => {
		await seedUser();
		const conn = await createCmsConnection(db, {
			userId: USER_ID,
			cmsType: "wordpress",
			siteUrl: "https://example.com",
			credentials: SAMPLE_CREDS,
		});

		const { credentials } = await getDecryptedCmsConnection(db, conn.id);
		expect(credentials).toEqual(SAMPLE_CREDS);
	});

	it("encryption AAD is bound to row identity (tampering with user_id breaks decrypt)", async () => {
		await seedUser();
		const conn = await createCmsConnection(db, {
			userId: USER_ID,
			cmsType: "wordpress",
			siteUrl: "https://example.com",
			credentials: SAMPLE_CREDS,
		});

		// Manually fetch the envelope and try to decrypt with a fabricated AAD
		// that uses a DIFFERENT user id. This simulates an attacker swapping
		// the row's user_id at the DB layer.
		const [row] = await db.select().from(cmsConnections).where(eq(cmsConnections.id, conn.id));
		const fakeAad = cmsCredentialsAad(row.id, "99999999-9999-4999-a999-999999999999");
		expect(() =>
			decryptCmsCredentials({
				envelope: row.encryptedCredentials as string,
				aad: fakeAad,
			}),
		).toThrow(/authentication failed/);
	});

	// ── listFixesByScan filters soft-deleted by default ─────────────────

	it("listFixesByScan hides soft-deleted rows by default and includes them on opt-in", async () => {
		await seedUser();
		const scanId = await seedScan();
		const fix = await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "llms_txt",
			content: "x",
			contentHash: "h",
		});
		await softDeleteFix(db, fix.id);

		const visible = await listFixesByScan(db, scanId);
		expect(visible).toHaveLength(0);

		const all = await listFixesByScan(db, scanId, { includeDeleted: true });
		expect(all).toHaveLength(1);
	});

	// ── createGeneratedFix concurrency retry (PR review P1) ─────────────

	it("createGeneratedFix retries on 23505 race so concurrent inserts both succeed with distinct versions", async () => {
		await seedUser();
		const scanId = await seedScan();

		const inputs = Array.from({ length: 5 }, (_, i) => ({
			scanId,
			userId: USER_ID,
			fixType: "llms_txt" as const,
			content: `# concurrent v${i}`,
			contentHash: `concurrent-hash-${i}`,
		}));

		const results = await Promise.all(inputs.map((input) => createGeneratedFix(db, input)));

		// All 5 must succeed and produce contiguous versions 1..5 in some order.
		const versions = results.map((r) => r.version).sort((a, b) => a - b);
		expect(versions).toEqual([1, 2, 3, 4, 5]);
		// All ids are distinct.
		expect(new Set(results.map((r) => r.id)).size).toBe(5);
	});

	// ── updateDeploymentStatus selective patch (PR review P1) ───────────

	it("updateDeploymentStatus does not wipe rollback_data / completed_at on intermediate transitions", async () => {
		await seedUser();
		const scanId = await seedScan();
		const fix = await createGeneratedFix(db, {
			scanId,
			userId: USER_ID,
			fixType: "llms_txt",
			content: "x",
			contentHash: "h",
		});
		const conn = await createCmsConnection(db, {
			userId: USER_ID,
			cmsType: "wordpress",
			siteUrl: "https://example.com",
			credentials: SAMPLE_CREDS,
		});
		const deployment = await createDeploymentAttempt(db, {
			fixId: fix.id,
			cmsConnectionId: conn.id,
		});

		// Step 1: terminal write that records rollback context + completed_at.
		const completedAt = new Date("2026-04-07T12:00:00Z");
		await updateDeploymentStatus(db, deployment.id, {
			status: "succeeded",
			rollbackData: {
				cms: "wordpress",
				strategy: "delete_file",
				filePath: "/llms.txt",
				capturedAt: completedAt.toISOString(),
			},
			completedAt,
		});

		// Step 2: a follow-up status transition (e.g. supervisor mark-as-failed)
		// that does NOT repeat the rollback payload. The audit history must
		// preserve the previously written rollbackData and completedAt.
		await updateDeploymentStatus(db, deployment.id, { status: "failed" });

		const [row] = await db
			.select()
			.from(deploymentAttempts)
			.where(eq(deploymentAttempts.id, deployment.id));
		expect(row.status).toBe("failed");
		expect(row.rollbackData).not.toBeNull();
		expect(row.completedAt).not.toBeNull();
		expect((row.rollbackData as { cms: string }).cms).toBe("wordpress");
	});

	// DSGVO deletion sweeper test removed — the `deleteUserAccount` helper
	// and the per-user deletion chain were part of the auth layer that was
	// archived during the OSS conversion. If a future PR re-enables auth,
	// the sweeper + test should come back together.
});
