import type { LevelScores } from "@beacon/shared";
import { SNAPSHOT_TYPES } from "@beacon/shared";
import { relations, sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { AI_ENGINES } from "./ai-visibility";
import { monitoringProjects } from "./monitoring";
import { scans } from "./scans";

// ── Enum constants (repo convention: no pgEnum) ─────────────

export const MILESTONE_TYPES = [
	"score_threshold",
	"citation_milestone",
	"first_mention",
	"improvement_rate",
] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export const ROI_REPORT_FORMATS = ["pdf", "html"] as const;
export type RoiReportFormat = (typeof ROI_REPORT_FORMATS)[number];

// ── score_snapshots ─────────────────────────────────────────

export const scoreSnapshots = pgTable(
	"score_snapshots",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		scanId: uuid("scan_id").references(() => scans.id, { onDelete: "set null" }),
		overallScore: integer("overall_score").notNull(),
		readinessLevel: integer("readiness_level").notNull(),
		subScores: jsonb("sub_scores").$type<LevelScores>().notNull(),
		aiCitationCount: integer("ai_citation_count").notNull().default(0),
		snapshotType: text("snapshot_type", { enum: SNAPSHOT_TYPES }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_score_snapshots_project_created").on(table.projectId, table.createdAt.desc()),
		index("idx_score_snapshots_baseline")
			.on(table.projectId, table.createdAt)
			.where(sql`${table.snapshotType} = 'baseline'`),
		index("idx_score_snapshots_scan").on(table.scanId),
	],
);

// ── roi_reports ─────────────────────────────────────────────

export const roiReports = pgTable(
	"roi_reports",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		baselineSnapshotId: uuid("baseline_snapshot_id").references(() => scoreSnapshots.id, {
			onDelete: "set null",
		}),
		latestSnapshotId: uuid("latest_snapshot_id").references(() => scoreSnapshots.id, {
			onDelete: "set null",
		}),
		reportData: jsonb("report_data")
			.$type<{
				scoreDelta: number;
				citationDelta: number;
				improvements: Array<{ checkId: string; before: number; after: number }>;
				generatedAt: string;
				subScoreDeltas?: {
					readability: number | null;
					interactivity: number | null;
					transactional: number | null;
				};
				citationChanges?: Array<{ platform: string; before: number; after: number }>;
				milestones?: Array<{ type: string; description: string; triggeredAt: string }>;
				aiRecommendations?: {
					executiveSummary: string;
					recommendations: Array<{
						priority: number;
						title: string;
						description: string;
						impact: string;
					}>;
					outlook: string;
				};
				filePath?: string;
			}>()
			.notNull(),
		format: text("format", { enum: ROI_REPORT_FORMATS }).notNull().default("pdf"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("idx_roi_reports_project_created").on(table.projectId, table.createdAt.desc())],
);

// ── roi_milestones ──────────────────────────────────────────

export const roiMilestones = pgTable(
	"roi_milestones",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		milestoneType: text("milestone_type", { enum: MILESTONE_TYPES }).notNull(),
		milestoneData: jsonb("milestone_data")
			.$type<{
				threshold?: number;
				previousValue?: number;
				currentValue?: number;
				description?: string;
			}>()
			.notNull(),
		snapshotId: uuid("snapshot_id").references(() => scoreSnapshots.id, {
			onDelete: "set null",
		}),
		triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_roi_milestones_project_triggered").on(table.projectId, table.triggeredAt.desc()),
		index("idx_roi_milestones_type").on(table.projectId, table.milestoneType),
	],
);

// ── ai_citation_tracking ────────────────────────────────────

export const aiCitationTracking = pgTable(
	"ai_citation_tracking",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		projectId: uuid("project_id")
			.references(() => monitoringProjects.id, { onDelete: "cascade" })
			.notNull(),
		snapshotId: uuid("snapshot_id").references(() => scoreSnapshots.id, {
			onDelete: "set null",
		}),
		platform: text("platform", { enum: AI_ENGINES }).notNull(),
		citationUrl: text("citation_url").notNull(),
		citationContext: text("citation_context"),
		discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_ai_citation_tracking_project_discovered").on(
			table.projectId,
			table.discoveredAt.desc(),
		),
		index("idx_ai_citation_tracking_platform").on(
			table.projectId,
			table.platform,
			table.discoveredAt.desc(),
		),
		index("idx_ai_citation_tracking_url").on(table.citationUrl),
	],
);

// ── Relations (forward-only to avoid circular imports) ───────

export const scoreSnapshotsRelations = relations(scoreSnapshots, ({ one, many }) => ({
	project: one(monitoringProjects, {
		fields: [scoreSnapshots.projectId],
		references: [monitoringProjects.id],
	}),
	scan: one(scans, {
		fields: [scoreSnapshots.scanId],
		references: [scans.id],
	}),
	milestones: many(roiMilestones),
	citations: many(aiCitationTracking),
}));

export const roiReportsRelations = relations(roiReports, ({ one }) => ({
	project: one(monitoringProjects, {
		fields: [roiReports.projectId],
		references: [monitoringProjects.id],
	}),
	baselineSnapshot: one(scoreSnapshots, {
		fields: [roiReports.baselineSnapshotId],
		references: [scoreSnapshots.id],
		relationName: "baselineSnapshot",
	}),
	latestSnapshot: one(scoreSnapshots, {
		fields: [roiReports.latestSnapshotId],
		references: [scoreSnapshots.id],
		relationName: "latestSnapshot",
	}),
}));

export const roiMilestonesRelations = relations(roiMilestones, ({ one }) => ({
	project: one(monitoringProjects, {
		fields: [roiMilestones.projectId],
		references: [monitoringProjects.id],
	}),
	snapshot: one(scoreSnapshots, {
		fields: [roiMilestones.snapshotId],
		references: [scoreSnapshots.id],
	}),
}));

export const aiCitationTrackingRelations = relations(aiCitationTracking, ({ one }) => ({
	project: one(monitoringProjects, {
		fields: [aiCitationTracking.projectId],
		references: [monitoringProjects.id],
	}),
	snapshot: one(scoreSnapshots, {
		fields: [aiCitationTracking.snapshotId],
		references: [scoreSnapshots.id],
	}),
}));
