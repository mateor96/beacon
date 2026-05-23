import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type NewCompetitorScanResult,
	type NewCompetitorScoreHistory,
	competitorScanResults,
	competitorScoreHistory,
} from "../schema/competitive";
import { requireFirstRow } from "./utils";

// ── competitor scan results ──────────────────────────────

export function createScanResult(db: DbClient, data: NewCompetitorScanResult) {
	return db
		.insert(competitorScanResults)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "competitorScanResults.create"));
}

export function updateScanResult(
	db: DbClient,
	id: string,
	patch: Partial<{
		status: NewCompetitorScanResult["status"];
		readinessScore: number | null;
		jsonLdScore: number | null;
		llmsTxtScore: number | null;
		agentsMdScore: number | null;
		citationCount: number;
		details: NewCompetitorScanResult["details"];
		errorMessage: string | null;
		scanId: string | null;
	}>,
) {
	return db
		.update(competitorScanResults)
		.set(patch)
		.where(eq(competitorScanResults.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function getLatestScanForCompetitor(db: DbClient, competitorId: string) {
	return db.query.competitorScanResults.findFirst({
		where: eq(competitorScanResults.competitorId, competitorId),
		orderBy: desc(competitorScanResults.scannedAt),
	});
}

export function listCompletedScansForCompetitors(db: DbClient, competitorIds: string[]) {
	if (competitorIds.length === 0) return Promise.resolve([]);
	return db
		.select()
		.from(competitorScanResults)
		.where(
			and(
				sql`${competitorScanResults.competitorId} = ANY(${competitorIds})`,
				eq(competitorScanResults.status, "completed"),
			),
		)
		.orderBy(desc(competitorScanResults.scannedAt));
}

// ── score history ────────────────────────────────────────

export function appendScoreHistory(db: DbClient, data: NewCompetitorScoreHistory) {
	return db
		.insert(competitorScoreHistory)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "competitorScoreHistory.append"));
}

export function listHistoryForDomain(
	db: DbClient,
	domainKey: string,
	opts: { limit?: number } = {},
) {
	const { limit = 52 } = opts;
	return db.query.competitorScoreHistory.findMany({
		where: eq(competitorScoreHistory.domainKey, domainKey),
		orderBy: desc(competitorScoreHistory.recordedAt),
		limit,
	});
}

/** Delete history rows older than `cutoff`. Used by the 52-week retention cron. */
export function pruneHistoryOlderThan(db: DbClient, cutoff: Date) {
	return db
		.delete(competitorScoreHistory)
		.where(lt(competitorScoreHistory.recordedAt, cutoff))
		.returning({ id: competitorScoreHistory.id });
}
