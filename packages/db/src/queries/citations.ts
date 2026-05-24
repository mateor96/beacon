import { and, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type CitationMatchType,
	type CitationSnapshotType,
	type NewCitation,
	type NewCitationPageMapping,
	citationPageMappings,
	citationSnapshots,
	citationUrlAliases,
	citations,
	citedPages,
} from "../schema/citations";
import { siteCrawlPages, siteCrawls } from "../schema/crawls";
import { scans } from "../schema/scans";

/**
 * Insert a citation record for a given audit (scan) and model response.
 * Returns the full inserted row.
 */
export function createCitation(db: DbClient, data: NewCitation) {
	return db
		.insert(citations)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Return an existing citation record if one already exists for the same
 * (audit_id, model_name, query_text) tuple. Enables idempotent re-processing
 * of the same AI response without creating duplicate citation rows.
 */
export function findCitation(
	db: DbClient,
	params: { auditId: string; modelName: string; queryText: string },
) {
	return db.query.citations.findFirst({
		where: and(
			eq(citations.auditId, params.auditId),
			eq(citations.modelName, params.modelName),
			eq(citations.queryText, params.queryText),
		),
		columns: { id: true },
	});
}

/**
 * UPSERT a cited_page by URL. The URL column has a unique index so ON CONFLICT
 * returns the existing row. Returns the cited_pages.id.
 */
export async function upsertCitedPage(
	db: DbClient,
	data: {
		url: string;
		canonicalUrl: string | null;
		domain: string;
		clientPageId: string | null;
	},
): Promise<string> {
	const inserted = await db
		.insert(citedPages)
		.values({
			url: data.url,
			canonicalUrl: data.canonicalUrl,
			domain: data.domain,
			clientPageId: data.clientPageId,
		})
		.onConflictDoUpdate({
			target: citedPages.url,
			set: {
				// Preserve any existing link; only adopt the new link if it's non-null.
				// Otherwise an unmatched re-run would wipe a previous manual/auto link.
				clientPageId: sql`COALESCE(${citedPages.clientPageId}, EXCLUDED.client_page_id)`,
				updatedAt: sql`now()`,
			},
		})
		.returning({ id: citedPages.id });
	return inserted[0].id;
}

export interface CitationMappingInput {
	citedPageId: string;
	position: number;
	contextSnippet: string | null;
	matchType: CitationMatchType;
	matchConfidence?: number | null;
}

/**
 * Insert citation→page mappings in bulk. Uses ON CONFLICT DO NOTHING on the
 * (citation_id, cited_page_id, position) unique index to remain idempotent
 * across retries after a mid-batch failure. Returns the number of rows that
 * were actually inserted (not counting conflicts).
 */
export async function createMappings(
	db: DbClient,
	citationId: string,
	mappings: CitationMappingInput[],
): Promise<number> {
	if (mappings.length === 0) return 0;
	const values: NewCitationPageMapping[] = mappings.map((m) => ({
		citationId,
		citedPageId: m.citedPageId,
		position: m.position,
		contextSnippet: m.contextSnippet,
		matchType: m.matchType,
		matchConfidence: m.matchConfidence ?? null,
	}));
	const result = await db
		.insert(citationPageMappings)
		.values(values)
		.onConflictDoNothing({
			target: [
				citationPageMappings.citationId,
				citationPageMappings.citedPageId,
				citationPageMappings.position,
			],
		})
		.returning({
			id: citationPageMappings.id,
		});
	return result.length;
}

/**
 * Count existing mappings for a citation. Used to short-circuit idempotent
 * re-runs when mappings were already written in a previous attempt.
 */
export function countMappingsForCitation(db: DbClient, citationId: string) {
	return db
		.select({ count: sql<number>`count(*)::int` })
		.from(citationPageMappings)
		.where(eq(citationPageMappings.citationId, citationId))
		.then((rows) => rows[0]?.count ?? 0);
}

/**
 * Load candidate client pages for a crawl (used by the page matcher). Returns
 * id + url tuples.
 */
export function listClientPagesForCrawl(db: DbClient, crawlId: string) {
	return db
		.select({ clientPageId: siteCrawlPages.id, url: siteCrawlPages.url })
		.from(siteCrawlPages)
		.where(eq(siteCrawlPages.crawlId, crawlId));
}

/**
 * Load manual-alias entries keyed by raw citation URL. Pass the full set of
 * URLs from a batch; returns a Map so the matcher can short-circuit on known
 * aliases before doing the 3-stage cascade.
 */
export async function loadManualAliases(
	db: DbClient,
	urls: string[],
): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	if (urls.length === 0) return result;
	const rows = await db
		.select({ url: citationUrlAliases.url, clientPageId: citationUrlAliases.clientPageId })
		.from(citationUrlAliases)
		.where(inArray(citationUrlAliases.url, urls));
	for (const row of rows) result.set(row.url, row.clientPageId);
	return result;
}

/**
 * Update a mapping with a new match result — used when running the matcher
 * after initial extraction or when a manual link is applied retroactively.
 */
export function updateMappingMatch(
	db: DbClient,
	mappingId: string,
	data: {
		matchType: CitationMatchType;
		matchConfidence: number | null;
		citedPageClientPageId: string | null;
	},
) {
	// Update the mapping's match_type + confidence, and link the underlying
	// cited_page to the matched client page (so all future citations of the
	// same URL carry the match automatically).
	return db.transaction(async (tx) => {
		const updated = await tx
			.update(citationPageMappings)
			.set({ matchType: data.matchType, matchConfidence: data.matchConfidence })
			.where(eq(citationPageMappings.id, mappingId))
			.returning({ id: citationPageMappings.id, citedPageId: citationPageMappings.citedPageId });
		if (updated.length === 0) return null;
		if (data.citedPageClientPageId !== null) {
			await tx
				.update(citedPages)
				.set({ clientPageId: data.citedPageClientPageId })
				.where(eq(citedPages.id, updated[0].citedPageId));
		}
		return updated[0];
	});
}

/**
 * Persist a manual citation→page alias so the matcher auto-applies it on
 * future extractions of the same URL.
 */
export function upsertManualAlias(
	db: DbClient,
	data: { url: string; clientPageId: string; createdByUserId: string | null },
) {
	return db
		.insert(citationUrlAliases)
		.values({
			url: data.url,
			clientPageId: data.clientPageId,
			createdByUserId: data.createdByUserId,
		})
		.onConflictDoUpdate({
			target: citationUrlAliases.url,
			set: {
				clientPageId: data.clientPageId,
				createdByUserId: data.createdByUserId,
				updatedAt: sql`now()`,
			},
		})
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Lookup a citation by id with its mappings + cited-page urls. Used by the
 * manual-link API to locate the mapping record to update.
 */
export function findCitationWithMappings(db: DbClient, citationId: string) {
	return db.query.citations.findFirst({
		where: eq(citations.id, citationId),
		with: {
			mappings: {
				with: {
					citedPage: {
						columns: { id: true, url: true, canonicalUrl: true, clientPageId: true },
					},
				},
			},
		},
	});
}

// ── List / stats queries (API layer, #207) ─────────────────

export interface CitationListFilters {
	modelName?: string;
	domain?: string;
	dateFrom?: Date;
	dateTo?: Date;
	/** Cursor = extractedAt ISO timestamp of the last item from the previous page. */
	cursor?: Date;
	limit: number;
}

/**
 * List citations scoped to a user's scans, joined with any cited pages via
 * mappings. Cursor-paginated by `extracted_at DESC`, page size bounded by
 * the caller (routes enforce the hard limit). Filters on model, date range,
 * and cited-page domain apply.
 */
export async function listCitationsForUser(
	db: DbClient,
	userId: string,
	filters: CitationListFilters,
) {
	const conditions = [eq(scans.userId, userId)];
	if (filters.modelName) conditions.push(eq(citations.modelName, filters.modelName));
	if (filters.dateFrom) conditions.push(gte(citations.extractedAt, filters.dateFrom));
	if (filters.dateTo) conditions.push(lte(citations.extractedAt, filters.dateTo));
	if (filters.cursor) conditions.push(lt(citations.extractedAt, filters.cursor));
	if (filters.domain) conditions.push(eq(citedPages.domain, filters.domain));

	const selectCols = {
		id: citations.id,
		auditId: citations.auditId,
		modelName: citations.modelName,
		queryText: citations.queryText,
		extractedAt: citations.extractedAt,
	};

	if (filters.domain) {
		return db
			.selectDistinct(selectCols)
			.from(citations)
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.innerJoin(citationPageMappings, eq(citationPageMappings.citationId, citations.id))
			.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
			.where(and(...conditions))
			.orderBy(desc(citations.extractedAt))
			.limit(filters.limit + 1);
	}

	return db
		.selectDistinct(selectCols)
		.from(citations)
		.innerJoin(scans, eq(citations.auditId, scans.id))
		.where(and(...conditions))
		.orderBy(desc(citations.extractedAt))
		.limit(filters.limit + 1);
}

/**
 * Aggregated stats for a user's citations: total count, per-model breakdown,
 * top cited pages (with current+prior-period counts for trend indicator),
 * top cited domains, and a daily trend series over the requested window.
 * Queries run in parallel so a cold hit pays max(q) latency instead of sum(q).
 *
 * @param trendDays Sliding window in days for the trend series and the
 *   "current period" leg of the top-pages trend indicator. Defaults to 30.
 */
export async function getCitationStatsForUser(
	db: DbClient,
	userId: string,
	trendDays: 30 | 60 | 90 = 30,
) {
	const windowSql = sql.raw(`now() - interval '${trendDays} days'`);
	const priorWindowSql = sql.raw(`now() - interval '${trendDays * 2} days'`);

	const [totalRow, byModel, topPages, topDomains, trend] = await Promise.all([
		db
			.select({ total: sql<number>`count(${citations.id})::int` })
			.from(citations)
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.where(eq(scans.userId, userId)),
		db
			.select({
				modelName: citations.modelName,
				count: sql<number>`count(${citations.id})::int`,
			})
			.from(citations)
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.where(eq(scans.userId, userId))
			.groupBy(citations.modelName)
			.orderBy(desc(sql`count(${citations.id})`)),
		db
			.select({
				clientPageId: siteCrawlPages.id,
				url: siteCrawlPages.url,
				domain: citedPages.domain,
				count: sql<number>`count(*)::int`,
				currentPeriodCount: sql<number>`count(*) filter (where ${citations.extractedAt} >= ${windowSql})::int`,
				priorPeriodCount: sql<number>`count(*) filter (where ${citations.extractedAt} >= ${priorWindowSql} and ${citations.extractedAt} < ${windowSql})::int`,
			})
			.from(siteCrawlPages)
			.innerJoin(citedPages, eq(citedPages.clientPageId, siteCrawlPages.id))
			.innerJoin(citationPageMappings, eq(citationPageMappings.citedPageId, citedPages.id))
			.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.where(eq(scans.userId, userId))
			.groupBy(siteCrawlPages.id, siteCrawlPages.url, citedPages.domain)
			.orderBy(desc(sql`count(*)`))
			.limit(10),
		db
			.select({
				domain: citedPages.domain,
				count: sql<number>`count(*)::int`,
			})
			.from(citedPages)
			.innerJoin(citationPageMappings, eq(citationPageMappings.citedPageId, citedPages.id))
			.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.where(eq(scans.userId, userId))
			.groupBy(citedPages.domain)
			.orderBy(desc(sql`count(*)`))
			.limit(10),
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${citations.extractedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
				count: sql<number>`count(*)::int`,
			})
			.from(citations)
			.innerJoin(scans, eq(citations.auditId, scans.id))
			.where(and(eq(scans.userId, userId), gte(citations.extractedAt, windowSql)))
			.groupBy(sql`date_trunc('day', ${citations.extractedAt} at time zone 'UTC')`)
			.orderBy(sql`date_trunc('day', ${citations.extractedAt} at time zone 'UTC') asc`),
	]);

	const total = totalRow[0]?.total ?? 0;
	return { total, byModel, topPages, topDomains, trend };
}

/**
 * Instance-wide citation list — the anonymous/instance-scoped counterpart of
 * {@link listCitationsForUser}. Anonymous scans carry `scans.userId = null`, so
 * a user-scoped filter would match nothing; this variant drops the userId
 * predicate (and the now-unneeded scans join) and lists every citation in the
 * instance. Same cursor pagination and filters.
 */
export async function listCitationsForInstance(db: DbClient, filters: CitationListFilters) {
	const conditions = [];
	if (filters.modelName) conditions.push(eq(citations.modelName, filters.modelName));
	if (filters.dateFrom) conditions.push(gte(citations.extractedAt, filters.dateFrom));
	if (filters.dateTo) conditions.push(lte(citations.extractedAt, filters.dateTo));
	if (filters.cursor) conditions.push(lt(citations.extractedAt, filters.cursor));
	if (filters.domain) conditions.push(eq(citedPages.domain, filters.domain));
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const selectCols = {
		id: citations.id,
		auditId: citations.auditId,
		modelName: citations.modelName,
		queryText: citations.queryText,
		extractedAt: citations.extractedAt,
	};

	if (filters.domain) {
		return db
			.selectDistinct(selectCols)
			.from(citations)
			.innerJoin(citationPageMappings, eq(citationPageMappings.citationId, citations.id))
			.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
			.where(where)
			.orderBy(desc(citations.extractedAt))
			.limit(filters.limit + 1);
	}

	return db
		.selectDistinct(selectCols)
		.from(citations)
		.where(where)
		.orderBy(desc(citations.extractedAt))
		.limit(filters.limit + 1);
}

/**
 * Instance-wide citation stats — the instance-scoped counterpart of
 * {@link getCitationStatsForUser}. Drops the userId predicate/join so it
 * aggregates every citation in the instance (anonymous scans are
 * `userId = null`). Same shape: total, per-model, top pages, top domains, trend.
 */
export async function getCitationStatsForInstance(db: DbClient, trendDays: 30 | 60 | 90 = 30) {
	const windowSql = sql.raw(`now() - interval '${trendDays} days'`);
	const priorWindowSql = sql.raw(`now() - interval '${trendDays * 2} days'`);

	const [totalRow, byModel, topPages, topDomains, trend] = await Promise.all([
		db.select({ total: sql<number>`count(${citations.id})::int` }).from(citations),
		db
			.select({
				modelName: citations.modelName,
				count: sql<number>`count(${citations.id})::int`,
			})
			.from(citations)
			.groupBy(citations.modelName)
			.orderBy(desc(sql`count(${citations.id})`)),
		db
			.select({
				clientPageId: siteCrawlPages.id,
				url: siteCrawlPages.url,
				domain: citedPages.domain,
				count: sql<number>`count(*)::int`,
				currentPeriodCount: sql<number>`count(*) filter (where ${citations.extractedAt} >= ${windowSql})::int`,
				priorPeriodCount: sql<number>`count(*) filter (where ${citations.extractedAt} >= ${priorWindowSql} and ${citations.extractedAt} < ${windowSql})::int`,
			})
			.from(siteCrawlPages)
			.innerJoin(citedPages, eq(citedPages.clientPageId, siteCrawlPages.id))
			.innerJoin(citationPageMappings, eq(citationPageMappings.citedPageId, citedPages.id))
			.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
			.groupBy(siteCrawlPages.id, siteCrawlPages.url, citedPages.domain)
			.orderBy(desc(sql`count(*)`))
			.limit(10),
		db
			.select({
				domain: citedPages.domain,
				count: sql<number>`count(*)::int`,
			})
			.from(citedPages)
			.innerJoin(citationPageMappings, eq(citationPageMappings.citedPageId, citedPages.id))
			.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
			.groupBy(citedPages.domain)
			.orderBy(desc(sql`count(*)`))
			.limit(10),
		db
			.select({
				day: sql<string>`to_char(date_trunc('day', ${citations.extractedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
				count: sql<number>`count(*)::int`,
			})
			.from(citations)
			.where(gte(citations.extractedAt, windowSql))
			.groupBy(sql`date_trunc('day', ${citations.extractedAt} at time zone 'UTC')`)
			.orderBy(sql`date_trunc('day', ${citations.extractedAt} at time zone 'UTC') asc`),
	]);

	const total = totalRow[0]?.total ?? 0;
	return { total, byModel, topPages, topDomains, trend };
}

/**
 * List citations for a specific client page (via cited_pages.client_page_id),
 * joined back to the citing LLM response. Cursor-paginated by extractedAt.
 */
export async function listCitationsForPage(
	db: DbClient,
	userId: string,
	clientPageId: string,
	cursor: Date | undefined,
	limit: number,
) {
	const conditions = [eq(scans.userId, userId), eq(citedPages.clientPageId, clientPageId)];
	if (cursor) conditions.push(lt(citations.extractedAt, cursor));

	return db
		.selectDistinct({
			citationId: citations.id,
			citedPageId: citedPages.id,
			citedPageUrl: citedPages.url,
			modelName: citations.modelName,
			queryText: citations.queryText,
			position: citationPageMappings.position,
			contextSnippet: citationPageMappings.contextSnippet,
			matchType: citationPageMappings.matchType,
			matchConfidence: citationPageMappings.matchConfidence,
			extractedAt: citations.extractedAt,
		})
		.from(citationPageMappings)
		.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
		.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
		.innerJoin(scans, eq(citations.auditId, scans.id))
		.where(and(...conditions))
		.orderBy(desc(citations.extractedAt))
		.limit(limit + 1);
}

/**
 * Weekly frequency series for a client page's citations over the requested
 * number of weeks. Returned in ascending week order.
 */
export async function getCitationFrequencyForPage(
	db: DbClient,
	userId: string,
	clientPageId: string,
	weeks: number,
) {
	const windowSql = sql.raw(`now() - interval '${weeks} weeks'`);
	return db
		.select({
			week: sql<string>`to_char(date_trunc('week', ${citations.extractedAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
			count: sql<number>`count(*)::int`,
		})
		.from(citationPageMappings)
		.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
		.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
		.innerJoin(scans, eq(citations.auditId, scans.id))
		.where(
			and(
				eq(scans.userId, userId),
				eq(citedPages.clientPageId, clientPageId),
				gte(citations.extractedAt, windowSql),
			),
		)
		.groupBy(sql`date_trunc('week', ${citations.extractedAt} at time zone 'UTC')`)
		.orderBy(sql`date_trunc('week', ${citations.extractedAt} at time zone 'UTC') asc`);
}

/**
 * Basic metadata for a client (site_crawl_pages) page: id + url. Used to
 * label the detail view header without exposing the full crawl record.
 *
 * v0.2: instance-scoped — no user ownership join. The crawl_id FK
 * is preserved so soft-deleted pages still resolve.
 */
export function getClientPageMeta(db: DbClient, clientPageId: string) {
	return db
		.select({ id: siteCrawlPages.id, url: siteCrawlPages.url })
		.from(siteCrawlPages)
		.innerJoin(siteCrawls, eq(siteCrawlPages.crawlId, siteCrawls.id))
		.where(eq(siteCrawlPages.id, clientPageId))
		.limit(1)
		.then((rows) => rows[0] ?? null);
}

/**
 * Frequency-ordered citation list for a client page. Groups by query_text and
 * returns the most-frequent queries first, with the most-recent extraction
 * timestamp as a tiebreaker. Non-paginated (returns up to `limit` groups).
 * Used by the detail view's "frequency" sort mode.
 */
export async function listCitationFrequencyForPage(
	db: DbClient,
	userId: string,
	clientPageId: string,
	limit: number,
) {
	return db
		.select({
			queryText: citations.queryText,
			modelName: citations.modelName,
			count: sql<number>`count(distinct ${citations.id})::int`,
			lastExtractedAt: sql<Date>`max(${citations.extractedAt})`,
		})
		.from(citationPageMappings)
		.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
		.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
		.innerJoin(scans, eq(citations.auditId, scans.id))
		.where(and(eq(scans.userId, userId), eq(citedPages.clientPageId, clientPageId)))
		.groupBy(citations.queryText, citations.modelName)
		.orderBy(desc(sql`count(distinct ${citations.id})`), desc(sql`max(${citations.extractedAt})`))
		.limit(limit);
}

/**
 * Compute before/after impact comparison from citation_snapshots. Returns
 * paired totals per client page where both snapshot types exist.
 */
export async function getCitationImpactForUser(db: DbClient, userId: string) {
	const rows = await db
		.select({
			clientPageId: citationSnapshots.clientPageId,
			snapshotType: citationSnapshots.snapshotType,
			totalCitations: citationSnapshots.totalCitations,
			modelBreakdown: citationSnapshots.modelBreakdown,
			capturedAt: citationSnapshots.capturedAt,
		})
		.from(citationSnapshots)
		.innerJoin(scans, eq(citationSnapshots.auditId, scans.id))
		.where(eq(scans.userId, userId))
		.orderBy(desc(citationSnapshots.capturedAt));

	// Group latest before + latest after per client_page_id
	const byPage = new Map<
		string,
		{
			before?: {
				totalCitations: number;
				modelBreakdown: Record<string, number>;
				capturedAt: Date;
			};
			after?: {
				totalCitations: number;
				modelBreakdown: Record<string, number>;
				capturedAt: Date;
			};
		}
	>();
	for (const row of rows) {
		let bucket = byPage.get(row.clientPageId);
		if (!bucket) {
			bucket = {};
			byPage.set(row.clientPageId, bucket);
		}
		if (row.snapshotType === "before" && !bucket.before) {
			bucket.before = {
				totalCitations: row.totalCitations,
				modelBreakdown: row.modelBreakdown,
				capturedAt: row.capturedAt,
			};
		} else if (row.snapshotType === "after" && !bucket.after) {
			bucket.after = {
				totalCitations: row.totalCitations,
				modelBreakdown: row.modelBreakdown,
				capturedAt: row.capturedAt,
			};
		}
	}

	const pages: Array<{
		clientPageId: string;
		before: { totalCitations: number; modelBreakdown: Record<string, number>; capturedAt: Date };
		after: { totalCitations: number; modelBreakdown: Record<string, number>; capturedAt: Date };
		delta: number;
	}> = [];
	for (const [clientPageId, bucket] of byPage) {
		if (!bucket.before || !bucket.after) continue;
		pages.push({
			clientPageId,
			before: bucket.before,
			after: bucket.after,
			delta: bucket.after.totalCitations - bucket.before.totalCitations,
		});
	}
	pages.sort((a, b) => b.delta - a.delta);
	return pages;
}

// ── Snapshot writer / aggregator (#179) ─────────────────────

/**
 * Aggregate citation counts for a (auditId, clientPageId) pair from the raw
 * mapping rows. Produces totalCitations, modelBreakdown, and the list of
 * normalized URLs (unique). Used to build a citation_snapshots row.
 */
export async function aggregateCitationsForScanPage(
	db: DbClient,
	auditId: string,
	clientPageId: string,
): Promise<{ totalCitations: number; modelBreakdown: Record<string, number>; urls: string[] }> {
	const rows = await db
		.select({
			modelName: citations.modelName,
			url: citedPages.url,
		})
		.from(citationPageMappings)
		.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
		.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
		.where(and(eq(citations.auditId, auditId), eq(citedPages.clientPageId, clientPageId)));

	const modelBreakdown: Record<string, number> = {};
	const urlSet = new Set<string>();
	for (const row of rows) {
		modelBreakdown[row.modelName] = (modelBreakdown[row.modelName] ?? 0) + 1;
		urlSet.add(row.url);
	}
	return {
		totalCitations: rows.length,
		modelBreakdown,
		urls: Array.from(urlSet),
	};
}

/**
 * Insert a citation_snapshots row for a (auditId, clientPageId, type) triple.
 * Caller aggregates the counts via aggregateCitationsForScanPage and passes
 * totalCitations + modelBreakdown. Returns the inserted row.
 */
export function writeCitationSnapshot(
	db: DbClient,
	data: {
		auditId: string;
		clientPageId: string;
		snapshotType: CitationSnapshotType;
		totalCitations: number;
		modelBreakdown: Record<string, number>;
	},
) {
	return db
		.insert(citationSnapshots)
		.values({
			auditId: data.auditId,
			clientPageId: data.clientPageId,
			snapshotType: data.snapshotType,
			totalCitations: data.totalCitations,
			modelBreakdown: data.modelBreakdown,
		})
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Find the most recent snapshot of a given type for a client page, searching
 * across all audits. Used to load the "before" side of a delta computation.
 */
export function findLatestSnapshot(
	db: DbClient,
	clientPageId: string,
	snapshotType: CitationSnapshotType,
) {
	return db.query.citationSnapshots.findFirst({
		where: and(
			eq(citationSnapshots.clientPageId, clientPageId),
			eq(citationSnapshots.snapshotType, snapshotType),
		),
		orderBy: desc(citationSnapshots.capturedAt),
	});
}

/**
 * Aggregate before/after impact across all the caller's pages — sums totals,
 * merges model breakdowns, and diffs URL sets. Returns null if there isn't at
 * least one page with both a before and an after snapshot.
 */
export async function getAggregateImpactForUser(db: DbClient, userId: string) {
	const pages = await getCitationImpactForUser(db, userId);
	if (pages.length === 0) return null;

	let totalBefore = 0;
	let totalAfter = 0;
	const mergedBefore: Record<string, number> = {};
	const mergedAfter: Record<string, number> = {};
	for (const p of pages) {
		totalBefore += p.before.totalCitations;
		totalAfter += p.after.totalCitations;
		for (const [m, c] of Object.entries(p.before.modelBreakdown)) {
			mergedBefore[m] = (mergedBefore[m] ?? 0) + c;
		}
		for (const [m, c] of Object.entries(p.after.modelBreakdown)) {
			mergedAfter[m] = (mergedAfter[m] ?? 0) + c;
		}
	}

	// URL sets per page come from the mapping/cited-page join, not the snapshot
	// row, so we can produce gained/lost URL lists. Query once across all pages.
	const userPageIds = pages.map((p) => p.clientPageId);
	const urlRows = await db
		.select({
			clientPageId: citedPages.clientPageId,
			url: citedPages.url,
			capturedAt: citations.extractedAt,
		})
		.from(citationPageMappings)
		.innerJoin(citedPages, eq(citationPageMappings.citedPageId, citedPages.id))
		.innerJoin(citations, eq(citationPageMappings.citationId, citations.id))
		.innerJoin(scans, eq(citations.auditId, scans.id))
		.where(and(eq(scans.userId, userId), inArray(citedPages.clientPageId, userPageIds)));

	// Split URLs into "before period" (before any after-snapshot exists) and
	// "after period" (after the earliest after-snapshot was captured).
	const earliestAfterByPage = new Map<string, Date>();
	for (const p of pages) earliestAfterByPage.set(p.clientPageId, p.after.capturedAt);

	const beforeUrlSet = new Set<string>();
	const afterUrlSet = new Set<string>();
	for (const row of urlRows) {
		if (!row.clientPageId) continue;
		const cutoff = earliestAfterByPage.get(row.clientPageId);
		if (!cutoff) continue;
		if (row.capturedAt < cutoff) {
			beforeUrlSet.add(row.url);
		} else {
			afterUrlSet.add(row.url);
		}
	}

	const gainedCitations: string[] = [];
	const lostCitations: string[] = [];
	for (const url of afterUrlSet) if (!beforeUrlSet.has(url)) gainedCitations.push(url);
	for (const url of beforeUrlSet) if (!afterUrlSet.has(url)) lostCitations.push(url);

	return {
		totalBefore,
		totalAfter,
		mergedBefore,
		mergedAfter,
		pageCount: pages.length,
		gainedCitations,
		lostCitations,
	};
}
