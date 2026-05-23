import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { aiCompetitorBenchmarks } from "../schema/ai-visibility";
import { competitors } from "../schema/competitors";
import { requireFirstRow } from "./utils";

export function create(
	db: DbClient,
	data: {
		projectId: string;
		name: string;
		domain?: string | null;
		industry?: string | null;
		localeId?: string | null;
		aliases?: string[];
	},
) {
	return db
		.insert(competitors)
		.values({
			projectId: data.projectId,
			name: data.name,
			domain: data.domain ?? null,
			industry: data.industry ?? null,
			localeId: data.localeId ?? null,
			aliases: data.aliases ?? [],
		})
		.returning()
		.then((rows) => requireFirstRow(rows, "competitors.create"));
}

export function getByProjectId(db: DbClient, projectId: string) {
	return db.query.competitors.findMany({
		where: eq(competitors.projectId, projectId),
	});
}

/**
 * Locale-scoped competitor list (#248). Returns competitors attached to
 * this locale PLUS competitors with localeId=null (project-wide default
 * set). Pass null to get only the project-wide defaults.
 */
export function getByProjectAndLocale(db: DbClient, projectId: string, localeId: string | null) {
	const localeFilter =
		localeId === null
			? isNull(competitors.localeId)
			: or(isNull(competitors.localeId), eq(competitors.localeId, localeId));
	return db.query.competitors.findMany({
		where: and(eq(competitors.projectId, projectId), localeFilter),
	});
}

export function getById(db: DbClient, id: string) {
	return db.query.competitors.findFirst({
		where: eq(competitors.id, id),
	});
}

export function update(
	db: DbClient,
	id: string,
	data: {
		name?: string;
		domain?: string | null;
		aliases?: string[];
	},
) {
	return db
		.update(competitors)
		.set(data)
		.where(eq(competitors.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export function deleteById(db: DbClient, id: string) {
	return db
		.delete(competitors)
		.where(eq(competitors.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export async function getCompetitorsWithLatestBenchmarks(db: DbClient, projectId: string) {
	const comps = await db.query.competitors.findMany({
		where: eq(competitors.projectId, projectId),
		orderBy: desc(competitors.createdAt),
	});
	if (comps.length === 0) return [];

	// Latest benchmark per competitor name within this project.
	const latestRows = await db
		.select({
			competitorName: aiCompetitorBenchmarks.competitorName,
			shareOfVoice: aiCompetitorBenchmarks.shareOfVoice,
			avgSentiment: aiCompetitorBenchmarks.avgSentiment,
			avgRank: aiCompetitorBenchmarks.avgRank,
			model: aiCompetitorBenchmarks.aiEngine,
			benchmarkedAt: aiCompetitorBenchmarks.benchmarkedAt,
			rn: sql<number>`row_number() over (partition by ${aiCompetitorBenchmarks.competitorName} order by ${aiCompetitorBenchmarks.benchmarkedAt} desc)`,
		})
		.from(aiCompetitorBenchmarks)
		.where(eq(aiCompetitorBenchmarks.projectId, projectId));

	const latestByName = new Map<string, (typeof latestRows)[number]>();
	for (const r of latestRows) {
		if (Number(r.rn) === 1) latestByName.set(r.competitorName, r);
	}

	return comps.map((c) => {
		const b = latestByName.get(c.name);
		return {
			id: c.id,
			name: c.name,
			domain: c.domain,
			latestBenchmark: b
				? {
						shareOfVoice: Number(b.shareOfVoice),
						avgSentiment: Number(b.avgSentiment),
						avgRank: Number(b.avgRank),
						model: b.model,
						benchmarkedAt: b.benchmarkedAt.toISOString(),
					}
				: null,
		};
	});
}

export function getCompetitorKeywords(db: DbClient, projectId: string): Promise<string[]> {
	return db.query.competitors
		.findMany({
			where: eq(competitors.projectId, projectId),
		})
		.then((rows) => rows.flatMap((r) => [r.name, ...((r.aliases as string[]) ?? [])]));
}

/**
 * Count competitors for a project.
 * Used to enforce competitorBenchmarks plan limit.
 */
export async function countByProjectId(db: DbClient, projectId: string): Promise<number> {
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(competitors)
		.where(eq(competitors.projectId, projectId));
	return rows[0]?.count ?? 0;
}
