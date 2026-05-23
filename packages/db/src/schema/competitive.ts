import { relations } from "drizzle-orm";
import {
	bigint,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { competitors } from "./competitors";
import { scans } from "./scans";

// ── Enum constants ──────────────────────────────────────────

export const COMPETITOR_SCAN_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type CompetitorScanStatus = (typeof COMPETITOR_SCAN_STATUSES)[number];

export const TREND_DIRECTIONS = ["improving", "declining", "stable"] as const;
export type TrendDirection = (typeof TREND_DIRECTIONS)[number];

// ── competitor_scan_results ────────────────────────────────

export const competitorScanResults = pgTable(
	"competitor_scan_results",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		competitorId: uuid("competitor_id")
			.references(() => competitors.id, { onDelete: "cascade" })
			.notNull(),
		/** Reuses the main `scans` row when we run the full scan pipeline. */
		scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),
		readinessScore: integer("readiness_score"),
		jsonLdScore: integer("json_ld_score"),
		llmsTxtScore: integer("llms_txt_score"),
		agentsMdScore: integer("agents_md_score"),
		citationCount: integer("citation_count").notNull().default(0),
		details: jsonb("details").$type<Record<string, unknown> | null>(),
		status: text("status", { enum: COMPETITOR_SCAN_STATUSES }).notNull().default("pending"),
		errorMessage: text("error_message"),
		scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_competitor_scan_results_competitor").on(table.competitorId, table.scannedAt.desc()),
		index("idx_competitor_scan_results_status").on(table.status),
	],
);

// ── competitor_score_history ────────────────────────────────

/**
 * Time-series of readiness scores for a domain (competitor or client).
 * Appends on every successful scan; retention capped at 52 weeks by a
 * weekly cleanup cron.
 */
export const competitorScoreHistory = pgTable(
	"competitor_score_history",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		/**
		 * competitorId is null for client-domain history rows — we still want
		 * the time series for trend calculation on the client's own scores.
		 */
		competitorId: uuid("competitor_id").references(() => competitors.id, {
			onDelete: "cascade",
		}),
		/** Free-text key for client-domain rows (projectId or scan.url). */
		domainKey: text("domain_key").notNull(),
		score: integer("score").notNull(),
		citationCount: bigint("citation_count", { mode: "number" }).notNull().default(0),
		trend: text("trend", { enum: TREND_DIRECTIONS }),
		recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_competitor_score_history_key_time").on(table.domainKey, table.recordedAt.desc()),
		index("idx_competitor_score_history_competitor").on(table.competitorId),
	],
);

// ── Relations ──────────────────────────────────────────────

export const competitorScanResultsRelations = relations(competitorScanResults, ({ one }) => ({
	competitor: one(competitors, {
		fields: [competitorScanResults.competitorId],
		references: [competitors.id],
	}),
	scan: one(scans, {
		fields: [competitorScanResults.scanId],
		references: [scans.id],
	}),
}));

export const competitorScoreHistoryRelations = relations(competitorScoreHistory, ({ one }) => ({
	competitor: one(competitors, {
		fields: [competitorScoreHistory.competitorId],
		references: [competitors.id],
	}),
}));

// ── Type exports ───────────────────────────────────────────

export type CompetitorScanResult = typeof competitorScanResults.$inferSelect;
export type NewCompetitorScanResult = typeof competitorScanResults.$inferInsert;
export type CompetitorScoreHistory = typeof competitorScoreHistory.$inferSelect;
export type NewCompetitorScoreHistory = typeof competitorScoreHistory.$inferInsert;
