import { and, asc, count, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type AI_ENGINES,
	type MENTION_TYPES,
	type SENTIMENT_VALUES,
	aiCompetitorBenchmarks,
	aiMentions,
	aiRankings,
	aiSentimentScores,
	aiSnapshots,
	aiSourceAttributions,
} from "../schema/ai-visibility";
import type {
	NewAiCompetitorBenchmark,
	NewAiMention,
	NewAiRanking,
	NewAiSentimentScore,
	NewAiSnapshot,
	NewAiSourceAttribution,
} from "../types";
import { requireFirstRow } from "./utils";

// Cost Aggregation
export type CostAggregateRow = { key: string; totalCostCents: number; queryCount: number };

export async function getCostAggregates(
	db: DbClient,
	opts: { from?: Date; to?: Date; groupBy: "day" | "engine" },
): Promise<CostAggregateRow[]> {
	const conds: ReturnType<typeof eq>[] = [];
	if (opts.from) conds.push(gte(aiSnapshots.queriedAt, opts.from));
	if (opts.to) conds.push(lte(aiSnapshots.queriedAt, opts.to));

	const groupCol =
		opts.groupBy === "day"
			? sql<string>`to_char(date_trunc('day', ${aiSnapshots.queriedAt}), 'YYYY-MM-DD')`
			: aiSnapshots.aiEngine;

	const rows = await db
		.select({
			key: groupCol,
			totalCostCents: sql<number>`coalesce(sum(${aiSnapshots.costCents}), 0)::int`,
			queryCount: sql<number>`count(*)::int`,
		})
		.from(aiSnapshots)
		.where(conds.length > 0 ? and(...conds) : undefined)
		.groupBy(groupCol)
		.orderBy(sql`coalesce(sum(${aiSnapshots.costCents}), 0) desc`);

	return rows.map((r) => ({
		key: String(r.key),
		totalCostCents: Number(r.totalCostCents),
		queryCount: Number(r.queryCount),
	}));
}

// Snapshots
export function createSnapshot(db: DbClient, data: NewAiSnapshot) {
	return db
		.insert(aiSnapshots)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createSnapshot"));
}

export function getSnapshotsByProjectId(
	db: DbClient,
	projectId: string,
	opts: { from?: Date; to?: Date; limit?: number; offset?: number } = {},
) {
	const { from, to, limit = 20, offset = 0 } = opts;
	const conditions = [eq(aiSnapshots.projectId, projectId)];
	if (from) conditions.push(gte(aiSnapshots.queriedAt, from));
	if (to) conditions.push(lte(aiSnapshots.queriedAt, to));

	return db.query.aiSnapshots.findMany({
		where: and(...conditions),
		orderBy: desc(aiSnapshots.queriedAt),
		limit,
		offset,
	});
}

// Mentions
export function createMention(db: DbClient, data: NewAiMention) {
	return db
		.insert(aiMentions)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createMention"));
}

export function getMentionsByProjectId(
	db: DbClient,
	projectId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.aiMentions.findMany({
		where: eq(aiMentions.projectId, projectId),
		orderBy: desc(aiMentions.mentionedAt),
		limit,
		offset,
	});
}

export function getMentionById(db: DbClient, mentionId: string) {
	return db.query.aiMentions.findFirst({
		where: eq(aiMentions.id, mentionId),
	});
}

export function updateMentionSentiment(
	db: DbClient,
	mentionId: string,
	data: {
		sentiment: "positive" | "neutral" | "negative";
		sentimentConfidence: number;
		sentimentSource: "keyword" | "llm" | "manual";
		sentimentOverride?: boolean;
	},
) {
	return db
		.update(aiMentions)
		.set({
			sentiment: data.sentiment,
			sentimentConfidence: data.sentimentConfidence,
			sentimentSource: data.sentimentSource,
			...(data.sentimentOverride !== undefined
				? { sentimentOverride: data.sentimentOverride }
				: {}),
		})
		.where(eq(aiMentions.id, mentionId))
		.returning()
		.then((rows) => rows[0]);
}

export function batchUpdateMentionSentiments(
	db: DbClient,
	updates: Array<{
		mentionId: string;
		sentiment: "positive" | "neutral" | "negative";
		sentimentConfidence: number;
	}>,
) {
	return Promise.all(
		updates.map((u) =>
			db
				.update(aiMentions)
				.set({
					sentiment: u.sentiment,
					sentimentConfidence: u.sentimentConfidence,
					sentimentSource: "llm" as const,
				})
				.where(and(eq(aiMentions.id, u.mentionId), eq(aiMentions.sentimentOverride, false)))
				.returning()
				.then((rows) => rows[0]),
		),
	);
}

export function getMentionsBySnapshotId(db: DbClient, snapshotId: string) {
	return db.query.aiMentions.findMany({
		where: eq(aiMentions.snapshotId, snapshotId),
	});
}

// Rankings
export function createRanking(db: DbClient, data: NewAiRanking) {
	return db
		.insert(aiRankings)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createRanking"));
}

export function getRankingsByProjectId(
	db: DbClient,
	projectId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.aiRankings.findMany({
		where: eq(aiRankings.projectId, projectId),
		orderBy: desc(aiRankings.rankedAt),
		limit,
		offset,
	});
}

export function getRankingsByBrandAndEngine(
	db: DbClient,
	projectId: string,
	brandName: string,
	aiEngine: "chatgpt" | "perplexity" | "gemini" | "claude",
	opts: { from?: Date; to?: Date; limit?: number; offset?: number } = {},
) {
	const { from, to, limit = 50, offset = 0 } = opts;
	const conditions = [
		eq(aiRankings.projectId, projectId),
		eq(aiRankings.brandName, brandName),
		eq(aiRankings.aiEngine, aiEngine),
	];
	if (from) conditions.push(gte(aiRankings.rankedAt, from));
	if (to) conditions.push(lte(aiRankings.rankedAt, to));

	return db.query.aiRankings.findMany({
		where: and(...conditions),
		orderBy: desc(aiRankings.rankedAt),
		limit,
		offset,
	});
}

export function getLatestRankings(db: DbClient, projectId: string, brandName: string) {
	return db.query.aiRankings.findMany({
		where: and(eq(aiRankings.projectId, projectId), eq(aiRankings.brandName, brandName)),
		orderBy: desc(aiRankings.rankedAt),
		limit: 4, // one per engine max
	});
}

export function getRankingsBySnapshotId(db: DbClient, snapshotId: string) {
	return db.query.aiRankings.findMany({
		where: eq(aiRankings.snapshotId, snapshotId),
	});
}

export function getRankingHistory(
	db: DbClient,
	projectId: string,
	brandName: string,
	opts: {
		aiEngine?: "chatgpt" | "perplexity" | "gemini" | "claude";
		from?: Date;
		to?: Date;
		limit?: number;
		offset?: number;
	} = {},
) {
	const { from, to, limit = 90, offset = 0 } = opts;
	const conditions = [eq(aiRankings.projectId, projectId), eq(aiRankings.brandName, brandName)];
	if (opts.aiEngine) conditions.push(eq(aiRankings.aiEngine, opts.aiEngine));
	if (from) conditions.push(gte(aiRankings.rankedAt, from));
	if (to) conditions.push(lte(aiRankings.rankedAt, to));

	return db.query.aiRankings.findMany({
		where: and(...conditions),
		orderBy: desc(aiRankings.rankedAt),
		limit,
		offset,
	});
}

// Sentiment Scores
export function createSentimentScore(db: DbClient, data: NewAiSentimentScore) {
	return db
		.insert(aiSentimentScores)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createSentimentScore"));
}

export function getSentimentByProjectId(
	db: DbClient,
	projectId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.aiSentimentScores.findMany({
		where: eq(aiSentimentScores.projectId, projectId),
		orderBy: desc(aiSentimentScores.scoredAt),
		limit,
		offset,
	});
}

// Source Attributions
export function createSourceAttribution(db: DbClient, data: NewAiSourceAttribution) {
	return db
		.insert(aiSourceAttributions)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createSourceAttribution"));
}

/**
 * Batch-insert attributions for a mention. Returns the number of rows
 * inserted (all, since there's no unique constraint).
 */
export async function createSourceAttributionsBatch(
	db: DbClient,
	rows: NewAiSourceAttribution[],
): Promise<number> {
	if (rows.length === 0) return 0;
	const result = await db
		.insert(aiSourceAttributions)
		.values(rows)
		.returning({ id: aiSourceAttributions.id });
	return result.length;
}

export function getAttributionsByMentionId(db: DbClient, mentionId: string) {
	return db.query.aiSourceAttributions.findMany({
		where: eq(aiSourceAttributions.mentionId, mentionId),
		orderBy: desc(aiSourceAttributions.attributedAt),
	});
}

/**
 * Own vs foreign source counts for a snapshot (joined via aiMentions.snapshotId).
 * Returns { ownCount, foreignCount, matchedCount, unstructuredCount }.
 */
export async function getAttributionStatsForSnapshot(
	db: DbClient,
	snapshotId: string,
): Promise<{
	ownCount: number;
	foreignCount: number;
	matchedCount: number;
	unstructuredCount: number;
}> {
	const rows = await db
		.select({
			ownCount: sql<number>`count(*) filter (where ${aiSourceAttributions.isOwnDomain} = true)::int`,
			foreignCount: sql<number>`count(*) filter (where ${aiSourceAttributions.isOwnDomain} = false)::int`,
			matchedCount: sql<number>`count(*) filter (where ${aiSourceAttributions.matchedPageId} is not null)::int`,
			unstructuredCount: sql<number>`count(*) filter (where ${aiSourceAttributions.sourceType} = 'unstructured')::int`,
		})
		.from(aiSourceAttributions)
		.innerJoin(aiMentions, eq(aiSourceAttributions.mentionId, aiMentions.id))
		.where(eq(aiMentions.snapshotId, snapshotId));
	const row = rows[0];
	return {
		ownCount: row?.ownCount ?? 0,
		foreignCount: row?.foreignCount ?? 0,
		matchedCount: row?.matchedCount ?? 0,
		unstructuredCount: row?.unstructuredCount ?? 0,
	};
}

// Competitor Benchmarks
export function createBenchmark(db: DbClient, data: NewAiCompetitorBenchmark) {
	return db
		.insert(aiCompetitorBenchmarks)
		.values(data)
		.returning()
		.then((rows) => requireFirstRow(rows, "aiVisibility.createBenchmark"));
}

// ── Monitoring API helpers ───────────────────────────────────

type Engine = (typeof AI_ENGINES)[number];
type Sentiment = (typeof SENTIMENT_VALUES)[number];
type MentionType = (typeof MENTION_TYPES)[number];

export type CursorKey = { t: Date; id: string };
export type Page = { cursor?: CursorKey | null; limit: number };

export type ListMentionsFilters = {
	models?: Engine[];
	sentiments?: Sentiment[];
	mentionType?: MentionType;
	from?: Date;
	to?: Date;
};

export type ListMentionsSort = "date" | "sentiment" | "model";
export type ListMentionsDir = "asc" | "desc";

export type MentionListRow = {
	id: string;
	snapshotId: string;
	projectId: string;
	brandName: string;
	mentionType: MentionType;
	position: number | null;
	contextText: string | null;
	sentiment: Sentiment | null;
	sentimentConfidence: number | null;
	sentimentOverride: boolean | null;
	sentimentSource: string | null;
	mentionedAt: Date;
	model: Engine | null;
};

export async function listMentions(
	db: DbClient,
	projectId: string,
	filters: ListMentionsFilters,
	page: Page & { sort?: ListMentionsSort; dir?: ListMentionsDir },
): Promise<{ items: MentionListRow[]; nextCursor: CursorKey | null }> {
	const sort = page.sort ?? "date";
	const dir = page.dir ?? "desc";
	const conds = [eq(aiMentions.projectId, projectId)];
	if (filters.sentiments && filters.sentiments.length > 0)
		conds.push(inArray(aiMentions.sentiment, filters.sentiments));
	if (filters.mentionType) conds.push(eq(aiMentions.mentionType, filters.mentionType));
	if (filters.from) conds.push(gte(aiMentions.mentionedAt, filters.from));
	if (filters.to) conds.push(lte(aiMentions.mentionedAt, filters.to));

	// Cursor pagination only valid for sort=date (composite cursors not yet supported).
	if (page.cursor && sort === "date") {
		const cursorCond = or(
			lt(aiMentions.mentionedAt, page.cursor.t),
			and(eq(aiMentions.mentionedAt, page.cursor.t), lt(aiMentions.id, page.cursor.id)),
		);
		if (cursorCond) conds.push(cursorCond);
	}

	if (filters.models && filters.models.length > 0)
		conds.push(inArray(aiSnapshots.aiEngine, filters.models));

	// ORDER BY: sentiment uses CASE for natural ordering (positive>neutral>negative).
	const dirFn = dir === "asc" ? asc : desc;
	const sentimentRank = sql`CASE ${aiMentions.sentiment} WHEN 'positive' THEN 1 WHEN 'neutral' THEN 2 WHEN 'negative' THEN 3 ELSE 4 END`;
	const orderByClause =
		sort === "sentiment"
			? [dirFn(sentimentRank), desc(aiMentions.mentionedAt), desc(aiMentions.id)]
			: sort === "model"
				? [dirFn(aiSnapshots.aiEngine), desc(aiMentions.mentionedAt), desc(aiMentions.id)]
				: [desc(aiMentions.mentionedAt), desc(aiMentions.id)];

	const rows = await db
		.select({
			id: aiMentions.id,
			snapshotId: aiMentions.snapshotId,
			projectId: aiMentions.projectId,
			brandName: aiMentions.brandName,
			mentionType: aiMentions.mentionType,
			position: aiMentions.position,
			contextText: aiMentions.contextText,
			sentiment: aiMentions.sentiment,
			sentimentConfidence: aiMentions.sentimentConfidence,
			sentimentOverride: aiMentions.sentimentOverride,
			sentimentSource: aiMentions.sentimentSource,
			mentionedAt: aiMentions.mentionedAt,
			model: aiSnapshots.aiEngine,
		})
		.from(aiMentions)
		.leftJoin(aiSnapshots, eq(aiSnapshots.id, aiMentions.snapshotId))
		.where(and(...conds))
		.orderBy(...orderByClause)
		.limit(page.limit + 1);

	const hasMore = rows.length > page.limit;
	const items = (hasMore ? rows.slice(0, page.limit) : rows) as unknown as MentionListRow[];
	const last = items[items.length - 1];
	// Cursor only meaningful for date sort.
	const nextCursor: CursorKey | null =
		sort === "date" && hasMore && last ? { t: last.mentionedAt, id: last.id } : null;
	return { items, nextCursor };
}

/**
 * Project-scoped mention fetch joined with snapshot to expose `model` and the
 * snapshot's `responseText` for the detail sheet. Returns null when missing.
 */
export async function getMentionForProject(
	db: DbClient,
	projectId: string,
	mentionId: string,
): Promise<
	| (MentionListRow & {
			snapshotQueryText: string | null;
			snapshotRawResponse: unknown;
	  })
	| null
> {
	const rows = await db
		.select({
			id: aiMentions.id,
			snapshotId: aiMentions.snapshotId,
			projectId: aiMentions.projectId,
			brandName: aiMentions.brandName,
			mentionType: aiMentions.mentionType,
			position: aiMentions.position,
			contextText: aiMentions.contextText,
			sentiment: aiMentions.sentiment,
			sentimentConfidence: aiMentions.sentimentConfidence,
			sentimentOverride: aiMentions.sentimentOverride,
			sentimentSource: aiMentions.sentimentSource,
			mentionedAt: aiMentions.mentionedAt,
			model: aiSnapshots.aiEngine,
			snapshotQueryText: aiSnapshots.queryText,
			snapshotRawResponse: aiSnapshots.rawResponse,
		})
		.from(aiMentions)
		.leftJoin(aiSnapshots, eq(aiSnapshots.id, aiMentions.snapshotId))
		.where(and(eq(aiMentions.id, mentionId), eq(aiMentions.projectId, projectId)))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	return row as unknown as MentionListRow & {
		snapshotQueryText: string | null;
		snapshotRawResponse: unknown;
	};
}

// ── Ranking trends (chart) ──────────────────────────────────

export type RankingTrendPoint = {
	day: string; // YYYY-MM-DD UTC
	brandName: string;
	aiEngine: Engine;
	rankPosition: number;
};

export type RankingTrendsResult = {
	points: RankingTrendPoint[];
	totalRowsInProject: number;
};

/**
 * Returns one ranking row per (brandName, aiEngine, day) — last snapshot of
 * the day wins via DISTINCT ON. Always returns integer ranks (column is NOT
 * NULL). totalRowsInProject is a project-wide unfiltered count used by the
 * UI to distinguish "never any data" from "no data in this range".
 */
export async function getRankingTrends(
	db: DbClient,
	projectId: string,
	opts: { from: Date; to: Date; brandNames?: string[] },
): Promise<RankingTrendsResult> {
	// Effective brand label = competitor_name when set, else brand_name. This
	// handles both schemas where competitor rankings are stored under
	// `brand_name` and where they live in the dedicated `competitor_name`
	// column.
	const brandFilter =
		opts.brandNames && opts.brandNames.length > 0
			? sql` and coalesce(competitor_name, brand_name) = any(${opts.brandNames})`
			: sql``;
	const result = await db.execute(sql`
		select distinct on (coalesce(competitor_name, brand_name), ai_engine, day)
			to_char(date_trunc('day', ranked_at at time zone 'UTC'), 'YYYY-MM-DD') as day,
			coalesce(competitor_name, brand_name) as "brandName",
			ai_engine as "aiEngine",
			rank_position as "rankPosition"
		from ai_rankings
		where project_id = ${projectId}
			and ranked_at >= ${opts.from}
			and ranked_at <= ${opts.to}${brandFilter}
		order by coalesce(competitor_name, brand_name), ai_engine, day, ranked_at desc
	`);
	// Drizzle's db.execute returns the row array directly with the configured
	// node-postgres driver in this codebase.
	const rows = result as unknown as Array<{
		day: string;
		brandName: string;
		aiEngine: Engine;
		rankPosition: number;
	}>;

	const totalRow = await db
		.select({ c: count() })
		.from(aiRankings)
		.where(eq(aiRankings.projectId, projectId));

	return {
		points: rows.map((r) => ({
			day: r.day,
			brandName: r.brandName,
			aiEngine: r.aiEngine,
			rankPosition: Number(r.rankPosition),
		})),
		totalRowsInProject: Number(totalRow[0]?.c ?? 0),
	};
}

export type ListRankingsFilters = {
	model?: Engine;
	brand?: string;
	from?: Date;
	to?: Date;
};

export async function listRankings(
	db: DbClient,
	projectId: string,
	filters: ListRankingsFilters,
	page: Page,
): Promise<{
	items: Awaited<ReturnType<typeof getRankingsByProjectId>>;
	nextCursor: CursorKey | null;
}> {
	const conds = [eq(aiRankings.projectId, projectId)];
	if (filters.model) conds.push(eq(aiRankings.aiEngine, filters.model));
	if (filters.brand) conds.push(eq(aiRankings.brandName, filters.brand));
	if (filters.from) conds.push(gte(aiRankings.rankedAt, filters.from));
	if (filters.to) conds.push(lte(aiRankings.rankedAt, filters.to));
	if (page.cursor) {
		const cursorCond = or(
			lt(aiRankings.rankedAt, page.cursor.t),
			and(eq(aiRankings.rankedAt, page.cursor.t), lt(aiRankings.id, page.cursor.id)),
		);
		if (cursorCond) conds.push(cursorCond);
	}

	const rows = await db
		.select()
		.from(aiRankings)
		.where(and(...conds))
		.orderBy(desc(aiRankings.rankedAt), desc(aiRankings.id))
		.limit(page.limit + 1);

	const hasMore = rows.length > page.limit;
	const items = hasMore ? rows.slice(0, page.limit) : rows;
	const last = items[items.length - 1];
	const nextCursor: CursorKey | null = hasMore && last ? { t: last.rankedAt, id: last.id } : null;
	return { items: items as never, nextCursor };
}

export async function getSentimentTimeseries(
	db: DbClient,
	projectId: string,
	opts: { from?: Date; to?: Date; granularity: "day" | "week" },
): Promise<
	Array<{ bucket: string; positive: number; neutral: number; negative: number; total: number }>
> {
	const conds = [eq(aiMentions.projectId, projectId)];
	if (opts.from) conds.push(gte(aiMentions.mentionedAt, opts.from));
	if (opts.to) conds.push(lte(aiMentions.mentionedAt, opts.to));

	const truncUnit = opts.granularity === "week" ? sql`'week'` : sql`'day'`;
	const bucket = sql<Date>`date_trunc(${truncUnit}, ${aiMentions.mentionedAt})`;

	const rows = await db
		.select({
			bucket,
			positive: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'positive')::int`,
			neutral: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'neutral')::int`,
			negative: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'negative')::int`,
			total: sql<number>`count(*)::int`,
		})
		.from(aiMentions)
		.where(and(...conds))
		.groupBy(bucket)
		.orderBy(bucket);

	return rows.map((r) => ({
		bucket: (r.bucket instanceof Date
			? r.bucket
			: new Date(r.bucket as unknown as string)
		).toISOString(),
		positive: Number(r.positive ?? 0),
		neutral: Number(r.neutral ?? 0),
		negative: Number(r.negative ?? 0),
		total: Number(r.total ?? 0),
	}));
}

/**
 * Compute the immediately preceding window of equal length.
 * prevTo is 1ms before `from`, prevFrom keeps the same duration.
 * Exported for unit testing.
 */
export function computePreviousWindow(from: Date, to: Date): { from: Date; to: Date } {
	const prevTo = new Date(from.getTime() - 1);
	const prevFrom = new Date(prevTo.getTime() - (to.getTime() - from.getTime()));
	return { from: prevFrom, to: prevTo };
}

type OverviewWindowResult = {
	totalMentions: number;
	mentionsBySentiment: { positive: number; neutral: number; negative: number };
	topBrands: Array<{ brandName: string; count: number }>;
	latestSnapshotAt: string | null;
	avgRankPosition: number | null;
	topModel: { model: Engine; count: number } | null;
};

async function runOverviewWindow(
	db: DbClient,
	projectId: string,
	from?: Date,
	to?: Date,
): Promise<OverviewWindowResult> {
	const mConds = [eq(aiMentions.projectId, projectId)];
	if (from) mConds.push(gte(aiMentions.mentionedAt, from));
	if (to) mConds.push(lte(aiMentions.mentionedAt, to));

	const rConds = [eq(aiRankings.projectId, projectId)];
	if (from) rConds.push(gte(aiRankings.rankedAt, from));
	if (to) rConds.push(lte(aiRankings.rankedAt, to));

	const sConds = [eq(aiSnapshots.projectId, projectId)];
	if (from) sConds.push(gte(aiSnapshots.queriedAt, from));
	if (to) sConds.push(lte(aiSnapshots.queriedAt, to));

	const [totalRow, sentimentRow, topBrands, latestSnapRow, avgRankRow, topModelRow] =
		await Promise.all([
			db
				.select({ c: count() })
				.from(aiMentions)
				.where(and(...mConds)),
			db
				.select({
					positive: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'positive')::int`,
					neutral: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'neutral')::int`,
					negative: sql<number>`count(*) filter (where ${aiMentions.sentiment} = 'negative')::int`,
				})
				.from(aiMentions)
				.where(and(...mConds)),
			db
				.select({ brandName: aiMentions.brandName, count: sql<number>`count(*)::int` })
				.from(aiMentions)
				.where(and(...mConds))
				.groupBy(aiMentions.brandName)
				.orderBy(sql`count(*) desc`)
				.limit(5),
			db
				.select({ queriedAt: aiSnapshots.queriedAt })
				.from(aiSnapshots)
				.where(and(...sConds))
				.orderBy(desc(aiSnapshots.queriedAt))
				.limit(1),
			db
				.select({ avg: sql<number>`avg(${aiRankings.rankPosition})::float` })
				.from(aiRankings)
				.where(and(...rConds)),
			db
				.select({ model: aiSnapshots.aiEngine, count: sql<number>`count(*)::int` })
				.from(aiMentions)
				.leftJoin(aiSnapshots, eq(aiSnapshots.id, aiMentions.snapshotId))
				.where(and(...mConds))
				.groupBy(aiSnapshots.aiEngine)
				.orderBy(sql`count(*) desc`)
				.limit(1),
		]);

	const sent = sentimentRow[0] ?? { positive: 0, neutral: 0, negative: 0 };
	const topModelRaw = topModelRow[0];
	const topModel = topModelRaw?.model
		? { model: topModelRaw.model as Engine, count: Number(topModelRaw.count ?? 0) }
		: null;
	return {
		totalMentions: Number(totalRow[0]?.c ?? 0),
		mentionsBySentiment: {
			positive: Number(sent.positive ?? 0),
			neutral: Number(sent.neutral ?? 0),
			negative: Number(sent.negative ?? 0),
		},
		topBrands: topBrands.map((b) => ({ brandName: b.brandName, count: Number(b.count ?? 0) })),
		latestSnapshotAt: latestSnapRow[0]?.queriedAt ? latestSnapRow[0].queriedAt.toISOString() : null,
		avgRankPosition: avgRankRow[0]?.avg != null ? Number(avgRankRow[0].avg) : null,
		topModel,
	};
}

export async function getOverviewAggregates(
	db: DbClient,
	projectId: string,
	opts: { from?: Date; to?: Date } = {},
): Promise<
	OverviewWindowResult & {
		previousPeriod: { totalMentions: number; avgRankPosition: number | null } | null;
	}
> {
	const current = await runOverviewWindow(db, projectId, opts.from, opts.to);
	let previousPeriod: { totalMentions: number; avgRankPosition: number | null } | null = null;
	if (opts.from && opts.to) {
		const prev = computePreviousWindow(opts.from, opts.to);
		const prevRes = await runOverviewWindow(db, projectId, prev.from, prev.to);
		previousPeriod = {
			totalMentions: prevRes.totalMentions,
			avgRankPosition: prevRes.avgRankPosition,
		};
	}
	return { ...current, previousPeriod };
}

export function getBenchmarksByProjectId(
	db: DbClient,
	projectId: string,
	opts: { limit?: number; offset?: number } = {},
) {
	const { limit = 20, offset = 0 } = opts;
	return db.query.aiCompetitorBenchmarks.findMany({
		where: eq(aiCompetitorBenchmarks.projectId, projectId),
		orderBy: desc(aiCompetitorBenchmarks.benchmarkedAt),
		limit,
		offset,
	});
}
