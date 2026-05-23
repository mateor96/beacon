import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { monitoringProjects } from "./monitoring";

export const AI_ENGINES = ["chatgpt", "perplexity", "gemini", "claude"] as const;
export const SENTIMENT_VALUES = ["positive", "neutral", "negative"] as const;
export const MENTION_TYPES = ["recommendation", "comparison", "citation", "passing"] as const;
export const SENTIMENT_SOURCES = ["keyword", "llm", "manual"] as const;

export const aiSnapshots = pgTable(
	"ai_snapshots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		brandName: text("brand_name").notNull(),
		aiEngine: text("ai_engine", { enum: AI_ENGINES }).notNull(),
		queryText: text("query_text").notNull(),
		rawResponse: jsonb("raw_response").notNull(),
		costCents: integer("cost_cents"),
		queriedAt: timestamp("queried_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_snapshots_project_queried").on(table.projectId, table.queriedAt.desc()),
		index("idx_ai_snapshots_brand_engine_queried").on(
			table.brandName,
			table.aiEngine,
			table.queriedAt.desc(),
		),
	],
);

export const aiMentions = pgTable(
	"ai_mentions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snapshotId: uuid("snapshot_id")
			.references(() => aiSnapshots.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		brandName: text("brand_name").notNull(),
		mentionType: text("mention_type", { enum: MENTION_TYPES }).notNull(),
		position: integer("position"),
		contextText: text("context_text"),
		sentiment: text("sentiment", { enum: SENTIMENT_VALUES }),
		sentimentConfidence: real("sentiment_confidence"),
		sentimentOverride: boolean("sentiment_override").notNull().default(false),
		sentimentSource: text("sentiment_source", { enum: SENTIMENT_SOURCES })
			.notNull()
			.default("keyword"),
		mentionedAt: timestamp("mentioned_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_mentions_project_brand_mentioned").on(
			table.projectId,
			table.brandName,
			table.mentionedAt.desc(),
		),
		index("idx_ai_mentions_snapshot").on(table.snapshotId),
		index("idx_ai_mentions_mentioned").on(table.mentionedAt.desc()),
	],
);

export const aiRankings = pgTable(
	"ai_rankings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snapshotId: uuid("snapshot_id")
			.references(() => aiSnapshots.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		brandName: text("brand_name").notNull(),
		aiEngine: text("ai_engine", { enum: AI_ENGINES }).notNull(),
		rankPosition: integer("rank_position").notNull(),
		competitorName: text("competitor_name"),
		queryText: text("query_text").notNull(),
		rankedAt: timestamp("ranked_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_rankings_project_brand_engine_ranked").on(
			table.projectId,
			table.brandName,
			table.aiEngine,
			table.rankedAt.desc(),
		),
		index("idx_ai_rankings_snapshot").on(table.snapshotId),
	],
);

export const aiSentimentScores = pgTable(
	"ai_sentiment_scores",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snapshotId: uuid("snapshot_id")
			.references(() => aiSnapshots.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		brandName: text("brand_name").notNull(),
		sentimentScore: real("sentiment_score").notNull(),
		positiveCount: integer("positive_count").notNull().default(0),
		neutralCount: integer("neutral_count").notNull().default(0),
		negativeCount: integer("negative_count").notNull().default(0),
		scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_sentiment_scores_project_brand_scored").on(
			table.projectId,
			table.brandName,
			table.scoredAt.desc(),
		),
		index("idx_ai_sentiment_scores_snapshot").on(table.snapshotId),
	],
);

export const SOURCE_ATTRIBUTION_TYPES = ["structured", "unstructured"] as const;
export type SourceAttributionType = (typeof SOURCE_ATTRIBUTION_TYPES)[number];

export const aiSourceAttributions = pgTable(
	"ai_source_attributions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		mentionId: uuid("mention_id")
			.references(() => aiMentions.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		url: text("url").notNull(),
		domain: text("domain").notNull(),
		isOwnDomain: boolean("is_own_domain").notNull().default(false),
		matchedPageId: uuid("matched_page_id"),
		sourceType: text("source_type", { enum: SOURCE_ATTRIBUTION_TYPES })
			.notNull()
			.default("structured"),
		attributedAt: timestamp("attributed_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_source_attributions_mention").on(table.mentionId),
		index("idx_ai_source_attributions_project_attributed").on(
			table.projectId,
			table.attributedAt.desc(),
		),
		index("idx_ai_source_attributions_domain").on(table.domain),
		index("idx_ai_source_attributions_matched_page").on(table.matchedPageId),
	],
);

export const aiCompetitorBenchmarks = pgTable(
	"ai_competitor_benchmarks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		snapshotId: uuid("snapshot_id")
			.references(() => aiSnapshots.id, { onDelete: "cascade" })
			.notNull(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		competitorName: text("competitor_name").notNull(),
		aiEngine: text("ai_engine", { enum: AI_ENGINES }).notNull(),
		shareOfVoice: real("share_of_voice").notNull(),
		avgSentiment: real("avg_sentiment").notNull(),
		avgRank: real("avg_rank").notNull(),
		benchmarkedAt: timestamp("benchmarked_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_competitor_benchmarks_project_competitor_benchmarked").on(
			table.projectId,
			table.competitorName,
			table.benchmarkedAt.desc(),
		),
		index("idx_ai_competitor_benchmarks_snapshot").on(table.snapshotId),
	],
);

// Relations
export const aiSnapshotsRelations = relations(aiSnapshots, ({ one, many }) => ({
	project: one(monitoringProjects, {
		fields: [aiSnapshots.projectId],
		references: [monitoringProjects.id],
	}),
	mentions: many(aiMentions),
	rankings: many(aiRankings),
	sentimentScores: many(aiSentimentScores),
	benchmarks: many(aiCompetitorBenchmarks),
}));

export const aiMentionsRelations = relations(aiMentions, ({ one, many }) => ({
	snapshot: one(aiSnapshots, { fields: [aiMentions.snapshotId], references: [aiSnapshots.id] }),
	project: one(monitoringProjects, {
		fields: [aiMentions.projectId],
		references: [monitoringProjects.id],
	}),
	sourceAttributions: many(aiSourceAttributions),
}));

export const aiRankingsRelations = relations(aiRankings, ({ one }) => ({
	snapshot: one(aiSnapshots, { fields: [aiRankings.snapshotId], references: [aiSnapshots.id] }),
	project: one(monitoringProjects, {
		fields: [aiRankings.projectId],
		references: [monitoringProjects.id],
	}),
}));

export const aiSentimentScoresRelations = relations(aiSentimentScores, ({ one }) => ({
	snapshot: one(aiSnapshots, {
		fields: [aiSentimentScores.snapshotId],
		references: [aiSnapshots.id],
	}),
	project: one(monitoringProjects, {
		fields: [aiSentimentScores.projectId],
		references: [monitoringProjects.id],
	}),
}));

export const aiSourceAttributionsRelations = relations(aiSourceAttributions, ({ one }) => ({
	mention: one(aiMentions, {
		fields: [aiSourceAttributions.mentionId],
		references: [aiMentions.id],
	}),
	project: one(monitoringProjects, {
		fields: [aiSourceAttributions.projectId],
		references: [monitoringProjects.id],
	}),
}));

export const aiCompetitorBenchmarksRelations = relations(aiCompetitorBenchmarks, ({ one }) => ({
	snapshot: one(aiSnapshots, {
		fields: [aiCompetitorBenchmarks.snapshotId],
		references: [aiSnapshots.id],
	}),
	project: one(monitoringProjects, {
		fields: [aiCompetitorBenchmarks.projectId],
		references: [monitoringProjects.id],
	}),
}));
