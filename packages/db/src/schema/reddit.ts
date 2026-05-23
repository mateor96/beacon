import { relations } from "drizzle-orm";
import {
	bigint,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { citations } from "./citations";
import { monitoringProjects } from "./monitoring";

// ── Enum constants ──────────────────────────────────────────

export const REDDIT_SENTIMENT_VALUES = ["positive", "neutral", "negative"] as const;
export type RedditSentiment = (typeof REDDIT_SENTIMENT_VALUES)[number];

export const REDDIT_MENTION_TYPES = ["post", "comment"] as const;
export type RedditMentionType = (typeof REDDIT_MENTION_TYPES)[number];

// ── reddit_subreddit_meta ────────────────────────────────────

export const redditSubredditMeta = pgTable(
	"reddit_subreddit_meta",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(), // without r/ prefix, lowercased
		subscriberCount: bigint("subscriber_count", { mode: "number" }),
		lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [uniqueIndex("idx_reddit_subreddit_meta_name_uniq").on(table.name)],
);

// ── reddit_posts ─────────────────────────────────────────────

export const redditPosts = pgTable(
	"reddit_posts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/** Reddit's base36 ID (e.g. "1abc23"), unique per platform. */
		redditId: text("reddit_id").notNull(),
		subreddit: text("subreddit").notNull(),
		title: text("title").notNull(),
		body: text("body"),
		author: text("author"),
		score: integer("score").notNull().default(0),
		url: text("url").notNull(),
		/** When Reddit claims the post was created. */
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		/** When our worker first saw it. */
		discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
		/** Soft-delete: null = live, timestamp = hidden. */
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_reddit_posts_reddit_id_uniq").on(table.redditId),
		index("idx_reddit_posts_subreddit_created").on(table.subreddit, table.createdAt.desc()),
		index("idx_reddit_posts_created").on(table.createdAt.desc()),
		index("idx_reddit_posts_discovered").on(table.discoveredAt.desc()),
	],
);

// ── reddit_comments ──────────────────────────────────────────

export const redditComments = pgTable(
	"reddit_comments",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		redditId: text("reddit_id").notNull(),
		postId: uuid("post_id")
			.references(() => redditPosts.id, { onDelete: "cascade" })
			.notNull(),
		body: text("body").notNull(),
		author: text("author"),
		score: integer("score").notNull().default(0),
		url: text("url").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
	},
	(table) => [
		uniqueIndex("idx_reddit_comments_reddit_id_uniq").on(table.redditId),
		index("idx_reddit_comments_post").on(table.postId),
		index("idx_reddit_comments_created").on(table.createdAt.desc()),
	],
);

// ── reddit_mention_brands ─────────────────────────────────────

/**
 * Junction linking a reddit_post OR reddit_comment to a "brand"
 * (mapped to monitoring_projects.id — same convention as the i18n
 * vertical's domain_locales table). Polymorphic via mention_type.
 */
export const redditMentionBrands = pgTable(
	"reddit_mention_brands",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		mentionType: text("mention_type", { enum: REDDIT_MENTION_TYPES }).notNull(),
		/** Either a reddit_posts.id or reddit_comments.id (polymorphic; FK enforced by check in code). */
		mentionId: uuid("mention_id").notNull(),
		brandId: uuid("brand_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		keywordMatched: text("keyword_matched").notNull(),
		sentiment: text("sentiment", { enum: REDDIT_SENTIMENT_VALUES }),
		sentimentScore: doublePrecision("sentiment_score"), // -1.0..1.0 for richer gradients
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_reddit_mention_brands_uniq").on(
			table.mentionType,
			table.mentionId,
			table.brandId,
			table.keywordMatched,
		),
		index("idx_reddit_mention_brands_brand").on(table.brandId, table.createdAt.desc()),
		index("idx_reddit_mention_brands_mention").on(table.mentionType, table.mentionId),
		index("idx_reddit_mention_brands_sentiment").on(table.sentiment),
	],
);

// ── reddit_ai_citation_links ──────────────────────────────────

/**
 * Connects a tracked Reddit mention to an AI citation (#186).
 * Populated by the reddit-citation-linker when an AI response cites a
 * reddit.com URL that matches a known post/comment.
 */
export const redditAiCitationLinks = pgTable(
	"reddit_ai_citation_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		mentionType: text("mention_type", { enum: REDDIT_MENTION_TYPES }).notNull(),
		mentionId: uuid("mention_id").notNull(),
		citationId: uuid("citation_id")
			.references(() => citations.id, { onDelete: "cascade" })
			.notNull(),
		/** 1.0 = exact URL match, 0.7 = partial match (post id only, different subreddit case). */
		confidenceScore: doublePrecision("confidence_score").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("idx_reddit_ai_citation_links_uniq").on(
			table.mentionType,
			table.mentionId,
			table.citationId,
		),
		index("idx_reddit_ai_citation_links_citation").on(table.citationId),
		index("idx_reddit_ai_citation_links_mention").on(table.mentionType, table.mentionId),
	],
);

// ── Relations ────────────────────────────────────────────────

export const redditPostsRelations = relations(redditPosts, ({ many }) => ({
	comments: many(redditComments),
}));

export const redditCommentsRelations = relations(redditComments, ({ one }) => ({
	post: one(redditPosts, {
		fields: [redditComments.postId],
		references: [redditPosts.id],
	}),
}));

export const redditMentionBrandsRelations = relations(redditMentionBrands, ({ one }) => ({
	brand: one(monitoringProjects, {
		fields: [redditMentionBrands.brandId],
		references: [monitoringProjects.id],
	}),
}));

export const redditAiCitationLinksRelations = relations(redditAiCitationLinks, ({ one }) => ({
	citation: one(citations, {
		fields: [redditAiCitationLinks.citationId],
		references: [citations.id],
	}),
}));

// ── Type exports ─────────────────────────────────────────────

export type RedditPost = typeof redditPosts.$inferSelect;
export type NewRedditPost = typeof redditPosts.$inferInsert;
export type RedditComment = typeof redditComments.$inferSelect;
export type NewRedditComment = typeof redditComments.$inferInsert;
export type RedditMentionBrand = typeof redditMentionBrands.$inferSelect;
export type NewRedditMentionBrand = typeof redditMentionBrands.$inferInsert;
export type RedditAiCitationLink = typeof redditAiCitationLinks.$inferSelect;
export type NewRedditAiCitationLink = typeof redditAiCitationLinks.$inferInsert;
export type RedditSubredditMeta = typeof redditSubredditMeta.$inferSelect;
export type NewRedditSubredditMeta = typeof redditSubredditMeta.$inferInsert;
