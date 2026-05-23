import { HTML_CONTENT_RETENTION_HOURS } from "@beacon/shared";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { scans } from "../schema/scans";
import type { NewScan } from "../types";
import { requireFirstRow } from "./utils";

export async function countByUserId(db: DbClient, userId: string) {
	return db
		.select({ count: sql<number>`count(*)::int` })
		.from(scans)
		.where(eq(scans.userId, userId))
		.then((rows) => rows[0]?.count ?? 0);
}

interface LevelScores {
	readability: number | null;
	interactivity: number | null;
	transactional: number | null;
}

interface ScanCheck {
	id: string;
	name: string;
	status: string;
	category: string;
	severity: string;
	score: number;
	summary: string;
	issues: { message: string; severity: string; context?: string }[];
	details?: Record<string, unknown>;
}

interface GeneratedFix {
	checkId: string;
	content: string;
	filename: string;
	method: "rule-based" | "ai-generated" | "hybrid";
}

export function create(db: DbClient, data: NewScan) {
	return db
		.insert(scans)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "scans.create"));
}

export function getById(db: DbClient, id: string) {
	return db.query.scans.findFirst({
		where: eq(scans.id, id),
	});
}

export function getStatusById(db: DbClient, id: string) {
	return db.query.scans.findFirst({
		where: eq(scans.id, id),
		columns: {
			id: true,
			url: true,
			finalUrl: true,
			score: true,
			readinessLevel: true,
			levelScores: true,
			checks: true,
			fixes: true,
			status: true,
			errorMessage: true,
			processingDurationMs: true,
			scannedAt: true,
			updatedAt: true,
			fixStatuses: true,
			reportStatus: true,
			reportError: true,
			reportGeneratedAt: true,
			reportFileSizeBytes: true,
			userId: true,
			expiresAt: true,
		},
	});
}

export function getByUserId(
	db: DbClient,
	userId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.scans.findMany({
		where: eq(scans.userId, userId),
		orderBy: desc(scans.scannedAt),
		limit,
		offset,
	});
}

export function updateStatus(
	db: DbClient,
	id: string,
	status: "pending" | "processing" | "completed" | "failed",
	errorMessage?: string,
	processingDurationMs?: number,
) {
	return db
		.update(scans)
		.set({
			status,
			...(errorMessage !== undefined && { errorMessage }),
			...(processingDurationMs !== undefined && { processingDurationMs }),
		})
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateResults(
	db: DbClient,
	id: string,
	data: {
		score: number;
		readinessLevel: number;
		levelScores: LevelScores;
		checks: ScanCheck[];
		htmlContent?: string;
		finalUrl?: string;
	},
) {
	const setData: Record<string, unknown> = { ...data };
	if (data.htmlContent !== undefined) {
		setData.htmlContentExpiresAt = sql`NOW() + INTERVAL '${sql.raw(String(HTML_CONTENT_RETENTION_HOURS))} hours'`;
	}
	return db
		.update(scans)
		.set(setData)
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

/** Sets the scan's locale_id (used by locale-aware scan jobs, #214). */
export function updateLocale(db: DbClient, id: string, localeId: string | null) {
	return db
		.update(scans)
		.set({ localeId })
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

// ── Locale-aware result querying (#222) ─────────────────────

/**
 * List scans for a user, optionally filtered by locale.
 * Cursor-based pagination via the most recent `scannedAt`.
 */
export function listForUserByLocale(
	db: DbClient,
	userId: string,
	opts: { localeId?: string | null; limit?: number; before?: Date } = {},
) {
	const { localeId, limit = 20, before } = opts;
	const conditions = [eq(scans.userId, userId)];
	if (localeId !== undefined) {
		conditions.push(
			localeId === null ? sql`${scans.localeId} IS NULL` : eq(scans.localeId, localeId),
		);
	}
	if (before) {
		conditions.push(sql`${scans.scannedAt} < ${before.toISOString()}`);
	}
	return db.query.scans.findMany({
		where: conditions.length === 1 ? conditions[0] : and(...conditions),
		orderBy: desc(scans.scannedAt),
		limit,
	});
}

/**
 * Average completed scan score per locale for a given user. NULL locale_id
 * rows are grouped under the "(none)" bucket.
 */
export function averageScorePerLocale(db: DbClient, userId: string) {
	return db
		.select({
			localeId: scans.localeId,
			avgScore: sql<number>`AVG(${scans.score})::float`.as("avg_score"),
			count: sql<number>`COUNT(*)::int`.as("count"),
		})
		.from(scans)
		.where(and(eq(scans.userId, userId), eq(scans.status, "completed")))
		.groupBy(scans.localeId);
}

/**
 * Latest completed scan for each (user, locale) pair, restricted to a set
 * of locale IDs. Drives the locale-comparison view (#222 acceptance: GET
 * /api/domains/:id/results/compare?locales=...).
 */
export function latestScanPerLocale(db: DbClient, userId: string, localeIds: string[]) {
	if (localeIds.length === 0) return Promise.resolve([]);
	return db
		.select({
			localeId: scans.localeId,
			scanId: scans.id,
			score: scans.score,
			readinessLevel: scans.readinessLevel,
			scannedAt: scans.scannedAt,
		})
		.from(scans)
		.where(
			and(
				eq(scans.userId, userId),
				eq(scans.status, "completed"),
				sql`${scans.localeId} = ANY(${localeIds})`,
			),
		)
		.orderBy(scans.localeId, desc(scans.scannedAt));
}

export function updateAiAnalysis(
	db: DbClient,
	id: string,
	aiAnalysis: string,
	citationAiAnalysis?: string,
) {
	return db
		.update(scans)
		.set({
			aiAnalysis,
			...(citationAiAnalysis !== undefined && { citationAiAnalysis }),
		})
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateFixes(db: DbClient, id: string, fixes: GeneratedFix[]) {
	return db
		.update(scans)
		.set({ fixes })
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateCitationAnalysis(db: DbClient, id: string, citationAiAnalysis: string) {
	return db
		.update(scans)
		.set({ citationAiAnalysis })
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateReportTexts(db: DbClient, id: string, reportTexts: Record<string, unknown>) {
	return db
		.update(scans)
		.set({ reportTexts })
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function clearReportTexts(db: DbClient, id: string) {
	return db
		.update(scans)
		.set({ reportTexts: null })
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateAnalysisStatus(
	db: DbClient,
	id: string,
	type: "semantic" | "citation",
	status: "pending" | "processing" | "completed" | "failed",
	error?: string,
) {
	const setData =
		type === "semantic"
			? {
					aiAnalysisStatus: status,
					...(error !== undefined && { aiAnalysisError: error }),
					...(status !== "failed" && { aiAnalysisError: null }),
				}
			: {
					citationAnalysisStatus: status,
					...(error !== undefined && { citationAnalysisError: error }),
					...(status !== "failed" && { citationAnalysisError: null }),
				};

	return db
		.update(scans)
		.set(setData)
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function updateFixCheckStatus(
	db: DbClient,
	scanId: string,
	checkId: string,
	data: {
		status: string;
		error?: string | null;
		jobId?: string;
		startedAt?: string;
		completedAt?: string;
	},
) {
	const entry: Record<string, unknown> = { status: data.status };
	if (data.jobId !== undefined) entry.jobId = data.jobId;
	if (data.startedAt !== undefined) entry.startedAt = data.startedAt;
	if (data.completedAt !== undefined) entry.completedAt = data.completedAt;
	// Clear stale errors on non-failed transitions
	entry.error = data.status === "failed" ? (data.error ?? null) : null;

	const entryJson = JSON.stringify(entry);
	return db.execute(
		sql`UPDATE scans SET fix_statuses = jsonb_set(
			COALESCE(fix_statuses, '{}'::jsonb),
			ARRAY[${checkId}]::text[],
			COALESCE(fix_statuses -> ${checkId}, '{}'::jsonb) || ${entryJson}::jsonb,
			true
		) WHERE id = ${scanId}`,
	);
}

export function updateReportStatus(
	db: DbClient,
	id: string,
	status: "pending" | "processing" | "completed" | "failed",
	extra?: {
		error?: string;
		jobId?: string;
		generatedAt?: Date;
		fileSizeBytes?: number;
	},
) {
	const setData: Record<string, unknown> = {
		reportStatus: status,
		// Clear stale errors on non-failed transitions
		reportError: status === "failed" ? (extra?.error ?? null) : null,
	};
	if (extra?.jobId !== undefined) setData.reportJobId = extra.jobId;
	if (extra?.generatedAt !== undefined) setData.reportGeneratedAt = extra.generatedAt;
	if (extra?.fileSizeBytes !== undefined) setData.reportFileSizeBytes = extra.fileSizeBytes;

	return db
		.update(scans)
		.set(setData)
		.where(eq(scans.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function getAnalysisById(db: DbClient, id: string) {
	return db.query.scans.findFirst({
		where: eq(scans.id, id),
		columns: {
			id: true,
			url: true,
			status: true,
			aiAnalysis: true,
			citationAiAnalysis: true,
			aiAnalysisStatus: true,
			citationAnalysisStatus: true,
			aiAnalysisError: true,
			citationAnalysisError: true,
		},
	});
}

export function findStaleScans(db: DbClient, staleCutoff: Date, limit = 100) {
	return db.query.scans.findMany({
		where: and(
			inArray(scans.status, ["pending", "processing"]),
			lt(scans.scannedAt, staleCutoff),
			isNull(scans.quotaCompensatedAt),
		),
		columns: {
			id: true,
			userId: true,
			status: true,
			scannedAt: true,
		},
		limit,
	});
}

export function markCompensated(db: DbClient, id: string) {
	return db
		.update(scans)
		.set({
			status: "failed" as const,
			errorMessage: "Scan timed out (stale reaper)",
			quotaCompensatedAt: new Date(),
		})
		.where(and(eq(scans.id, id), isNull(scans.quotaCompensatedAt)))
		.returning({ id: scans.id })
		.then((rows) => rows[0]);
}
