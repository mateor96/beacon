import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import {
	type NewRedditAiCitationLink,
	type NewRedditComment,
	type NewRedditMentionBrand,
	type NewRedditPost,
	type NewRedditSubredditMeta,
	type RedditMentionType,
	type RedditSentiment,
	redditAiCitationLinks,
	redditComments,
	redditMentionBrands,
	redditPosts,
	redditSubredditMeta,
} from "../schema/reddit";
import { requireFirstRow } from "./utils";

// ── reddit_posts ────────────────────────────────────────────

export function getPostByRedditId(db: DbClient, redditId: string) {
	return db.query.redditPosts.findFirst({ where: eq(redditPosts.redditId, redditId) });
}

/** Idempotent insert. Returns the row on new insert, null on duplicate. */
export function upsertPost(db: DbClient, data: NewRedditPost) {
	return db
		.insert(redditPosts)
		.values(data)
		.onConflictDoNothing({ target: [redditPosts.redditId] })
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function listKnownPostIds(db: DbClient, redditIds: string[]) {
	if (redditIds.length === 0) return Promise.resolve([] as Array<{ redditId: string }>);
	return db
		.select({ redditId: redditPosts.redditId })
		.from(redditPosts)
		.where(inArray(redditPosts.redditId, redditIds));
}

// ── reddit_comments ─────────────────────────────────────────

export function getCommentByRedditId(db: DbClient, redditId: string) {
	return db.query.redditComments.findFirst({ where: eq(redditComments.redditId, redditId) });
}

export function upsertComment(db: DbClient, data: NewRedditComment) {
	return db
		.insert(redditComments)
		.values(data)
		.onConflictDoNothing({ target: [redditComments.redditId] })
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function listKnownCommentIds(db: DbClient, redditIds: string[]) {
	if (redditIds.length === 0) return Promise.resolve([] as Array<{ redditId: string }>);
	return db
		.select({ redditId: redditComments.redditId })
		.from(redditComments)
		.where(inArray(redditComments.redditId, redditIds));
}

// ── reddit_mention_brands ───────────────────────────────────

export function linkMentionToBrand(db: DbClient, data: NewRedditMentionBrand) {
	return db
		.insert(redditMentionBrands)
		.values(data)
		.onConflictDoNothing({
			target: [
				redditMentionBrands.mentionType,
				redditMentionBrands.mentionId,
				redditMentionBrands.brandId,
				redditMentionBrands.keywordMatched,
			],
		})
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function updateMentionSentiment(
	db: DbClient,
	id: string,
	sentiment: RedditSentiment,
	sentimentScore: number | null,
) {
	return db
		.update(redditMentionBrands)
		.set({ sentiment, sentimentScore })
		.where(eq(redditMentionBrands.id, id))
		.returning()
		.then((rows) => rows[0]);
}

export interface ListMentionsFilters {
	brandId: string;
	subreddit?: string;
	sentiment?: RedditSentiment;
	aiCitedOnly?: boolean;
	fromDate?: Date;
	toDate?: Date;
	limit?: number;
	offset?: number;
}

/**
 * Paginated feed for the /api/reddit-mentions route (#196).
 * Joins posts + comments via the polymorphic mention_type column.
 */
export function listMentionsForBrand(db: DbClient, filters: ListMentionsFilters) {
	const {
		brandId,
		subreddit,
		sentiment,
		aiCitedOnly,
		fromDate,
		toDate,
		limit = 20,
		offset = 0,
	} = filters;

	// Build the WHERE conditions
	const conditions = [eq(redditMentionBrands.brandId, brandId)];
	if (sentiment) conditions.push(eq(redditMentionBrands.sentiment, sentiment));
	if (fromDate) conditions.push(gte(redditMentionBrands.createdAt, fromDate));
	if (toDate) conditions.push(lte(redditMentionBrands.createdAt, toDate));

	// A left join across the polymorphic types — we return both post and
	// comment fields; the API layer picks whichever is non-null.
	const query = db
		.select({
			mention: redditMentionBrands,
			post: redditPosts,
			comment: redditComments,
			hasAiCitation: sql<boolean>`EXISTS (
				SELECT 1 FROM ${redditAiCitationLinks}
				WHERE ${redditAiCitationLinks.mentionType} = ${redditMentionBrands.mentionType}
				  AND ${redditAiCitationLinks.mentionId} = ${redditMentionBrands.mentionId}
			)`.as("has_ai_citation"),
		})
		.from(redditMentionBrands)
		.leftJoin(
			redditPosts,
			and(
				eq(redditMentionBrands.mentionType, "post"),
				eq(redditMentionBrands.mentionId, redditPosts.id),
			),
		)
		.leftJoin(
			redditComments,
			and(
				eq(redditMentionBrands.mentionType, "comment"),
				eq(redditMentionBrands.mentionId, redditComments.id),
			),
		)
		.where(
			subreddit
				? and(
						...conditions,
						sql`(${redditPosts.subreddit} = ${subreddit} OR ${redditComments.postId} IN (
							SELECT id FROM ${redditPosts} WHERE ${redditPosts.subreddit} = ${subreddit}
						))`,
					)
				: and(...conditions),
		)
		.orderBy(desc(redditMentionBrands.createdAt))
		.limit(limit)
		.offset(offset);

	if (aiCitedOnly) {
		return query.then((rows) => rows.filter((r) => r.hasAiCitation));
	}
	return query;
}

/**
 * Single mention for a brand by id (#481). Id-filtered in SQL so a mention
 * belonging to another brand cannot leak; mirrors `listMentionsForBrand`'s
 * projection so the API consumer consumes the same shape.
 */
export function getMentionForBrand(db: DbClient, filters: { brandId: string; mentionId: string }) {
	const { brandId, mentionId } = filters;
	return db
		.select({
			mention: redditMentionBrands,
			post: redditPosts,
			comment: redditComments,
			hasAiCitation: sql<boolean>`EXISTS (
				SELECT 1 FROM ${redditAiCitationLinks}
				WHERE ${redditAiCitationLinks.mentionType} = ${redditMentionBrands.mentionType}
				  AND ${redditAiCitationLinks.mentionId} = ${redditMentionBrands.mentionId}
			)`.as("has_ai_citation"),
		})
		.from(redditMentionBrands)
		.leftJoin(
			redditPosts,
			and(
				eq(redditMentionBrands.mentionType, "post"),
				eq(redditMentionBrands.mentionId, redditPosts.id),
			),
		)
		.leftJoin(
			redditComments,
			and(
				eq(redditMentionBrands.mentionType, "comment"),
				eq(redditMentionBrands.mentionId, redditComments.id),
			),
		)
		.where(and(eq(redditMentionBrands.id, mentionId), eq(redditMentionBrands.brandId, brandId)))
		.limit(1)
		.then((rows) => rows[0] ?? null);
}

export function countMentionsForBrand(db: DbClient, brandId: string) {
	return db
		.select({ count: sql<number>`COUNT(*)::int`.as("count") })
		.from(redditMentionBrands)
		.where(eq(redditMentionBrands.brandId, brandId))
		.then((rows) => rows[0]?.count ?? 0);
}

export function statsForBrand(db: DbClient, brandId: string) {
	return db
		.select({
			sentiment: redditMentionBrands.sentiment,
			count: sql<number>`COUNT(*)::int`.as("count"),
		})
		.from(redditMentionBrands)
		.where(eq(redditMentionBrands.brandId, brandId))
		.groupBy(redditMentionBrands.sentiment);
}

export function listSubredditsForBrand(db: DbClient, brandId: string) {
	return db
		.select({
			subreddit: redditPosts.subreddit,
			count: sql<number>`COUNT(*)::int`.as("count"),
		})
		.from(redditMentionBrands)
		.innerJoin(
			redditPosts,
			and(
				eq(redditMentionBrands.mentionType, "post"),
				eq(redditMentionBrands.mentionId, redditPosts.id),
			),
		)
		.where(eq(redditMentionBrands.brandId, brandId))
		.groupBy(redditPosts.subreddit)
		.orderBy(desc(sql`count`));
}

// ── reddit_ai_citation_links ────────────────────────────────

export function createCitationLink(db: DbClient, data: NewRedditAiCitationLink) {
	return db
		.insert(redditAiCitationLinks)
		.values(data)
		.onConflictDoNothing({
			target: [
				redditAiCitationLinks.mentionType,
				redditAiCitationLinks.mentionId,
				redditAiCitationLinks.citationId,
			],
		})
		.returning()
		.then((rows) => rows[0] ?? null);
}

export function listCitationLinksForMention(
	db: DbClient,
	mentionType: RedditMentionType,
	mentionId: string,
) {
	return db.query.redditAiCitationLinks.findMany({
		where: and(
			eq(redditAiCitationLinks.mentionType, mentionType),
			eq(redditAiCitationLinks.mentionId, mentionId),
		),
	});
}

// ── reddit_subreddit_meta ───────────────────────────────────

export function upsertSubredditMeta(db: DbClient, data: NewRedditSubredditMeta) {
	return db
		.insert(redditSubredditMeta)
		.values(data)
		.onConflictDoUpdate({
			target: [redditSubredditMeta.name],
			set: {
				subscriberCount: data.subscriberCount ?? null,
				lastCrawledAt: data.lastCrawledAt ?? null,
			},
		})
		.returning()
		.then((rows) => requireFirstRow(rows, "redditSubredditMeta.upsert"));
}

// ── soft-delete helpers ─────────────────────────────────────

export function softDeletePost(db: DbClient, id: string) {
	return db
		.update(redditPosts)
		.set({ deletedAt: new Date() })
		.where(and(eq(redditPosts.id, id), isNull(redditPosts.deletedAt)))
		.returning({ id: redditPosts.id });
}

export function softDeleteComment(db: DbClient, id: string) {
	return db
		.update(redditComments)
		.set({ deletedAt: new Date() })
		.where(and(eq(redditComments.id, id), isNull(redditComments.deletedAt)))
		.returning({ id: redditComments.id });
}
