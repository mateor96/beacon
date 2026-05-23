import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { locales } from "./locales";
import { profiles } from "./profiles";

export const scans = pgTable(
	"scans",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: uuid("user_id").references(() => profiles.id, {
			onDelete: "cascade",
		}), // DSGVO: personenbezogen (Verknüpfung)
		url: text("url").notNull(),
		finalUrl: text("final_url"),
		localeId: uuid("locale_id").references(() => locales.id, { onDelete: "set null" }),
		score: integer("score").notNull(),
		readinessLevel: integer("readiness_level").notNull(),
		levelScores: jsonb("level_scores").notNull(),
		checks: jsonb("checks").notNull(),
		fixes: jsonb("fixes").default("{}"),
		aiAnalysis: text("ai_analysis"),
		citationAiAnalysis: text("citation_ai_analysis"),
		reportTexts: jsonb("report_texts"),
		htmlContent: text("html_content"),
		aiAnalysisStatus: text("ai_analysis_status", {
			enum: ["pending", "processing", "completed", "failed"],
		}),
		aiAnalysisError: text("ai_analysis_error"),
		citationAnalysisStatus: text("citation_analysis_status", {
			enum: ["pending", "processing", "completed", "failed"],
		}),
		citationAnalysisError: text("citation_analysis_error"),
		fixStatuses: jsonb("fix_statuses"),
		reportStatus: text("report_status", {
			enum: ["pending", "processing", "completed", "failed"],
		}),
		reportError: text("report_error"),
		reportJobId: text("report_job_id"),
		reportGeneratedAt: timestamp("report_generated_at", { withTimezone: true }),
		reportFileSizeBytes: integer("report_file_size_bytes"),
		status: text("status", {
			enum: ["pending", "processing", "completed", "failed"],
		})
			.notNull()
			.default("pending"),
		processingDurationMs: integer("processing_duration_ms"),
		errorMessage: text("error_message"),
		scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdateFn(() => new Date()),
		quotaCompensatedAt: timestamp("quota_compensated_at", { withTimezone: true }),
		htmlContentExpiresAt: timestamp("html_content_expires_at", { withTimezone: true }).default(
			sql`NOW() + INTERVAL '72 hours'`,
		),
		expiresAt: timestamp("expires_at", { withTimezone: true }).default(
			sql`NOW() + INTERVAL '30 days'`,
		),
	},
	(table) => [
		index("idx_scans_user_scanned").on(table.userId, table.scannedAt.desc()),
		index("idx_scans_url").on(table.url),
		index("idx_scans_status").on(table.status).where(sql`${table.status} != 'completed'`),
		index("idx_scans_expires_at").on(table.expiresAt).where(sql`${table.expiresAt} IS NOT NULL`),
		index("idx_scans_user_locale").on(table.userId, table.localeId),
		index("idx_scans_user_locale_scanned").on(table.userId, table.localeId, table.scannedAt.desc()),
	],
);
