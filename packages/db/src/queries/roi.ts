import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import type { DbClient } from "../client";
import { monitoringProjects } from "../schema/monitoring";
import { aiCitationTracking, roiMilestones, roiReports, scoreSnapshots } from "../schema/roi";
import type { MilestoneType } from "../schema/roi";

/**
 * Find a monitoring project matching a scan URL for baseline snapshot creation.
 * Tries exact match on websiteUrl against both the original url and the
 * post-redirect finalUrl to handle http→https and www redirects.
 */
export function findProjectByUrl(db: DbClient, url: string, finalUrl?: string) {
	const urlCondition =
		finalUrl && finalUrl !== url
			? or(eq(monitoringProjects.websiteUrl, url), eq(monitoringProjects.websiteUrl, finalUrl))
			: eq(monitoringProjects.websiteUrl, url);

	return db.query.monitoringProjects.findFirst({
		where: urlCondition,
		columns: { id: true },
	});
}

/**
 * Check if a baseline snapshot already exists for a project.
 * Uses the partial index idx_score_snapshots_baseline for fast lookup.
 *
 * TODO: consider UNIQUE partial index (project_id) WHERE snapshot_type = 'baseline'
 * to enforce uniqueness at the DB level. Application-level guard is sufficient
 * for now since concurrent first-scans for the same project are rare.
 */
export function hasBaselineSnapshot(db: DbClient, projectId: string) {
	return db.query.scoreSnapshots.findFirst({
		where: and(
			eq(scoreSnapshots.projectId, projectId),
			eq(scoreSnapshots.snapshotType, "baseline"),
		),
		columns: { id: true },
	});
}

/**
 * Insert a baseline score snapshot. Caller must have verified no baseline
 * exists yet via hasBaselineSnapshot.
 */
export function createBaselineSnapshot(
	db: DbClient,
	data: {
		projectId: string;
		scanId: string;
		overallScore: number;
		readinessLevel: number;
		subScores: {
			readability: number | null;
			interactivity: number | null;
			transactional: number | null;
		};
	},
) {
	return db
		.insert(scoreSnapshots)
		.values({
			projectId: data.projectId,
			scanId: data.scanId,
			overallScore: data.overallScore,
			readinessLevel: data.readinessLevel,
			subScores: data.subScores,
			aiCitationCount: 0,
			snapshotType: "baseline",
		})
		.returning()
		.then((rows) => rows[0]);
}

// ─── Milestone detection queries (#274) ─────────────────────

/**
 * Get the most recent score snapshot for a project, optionally excluding a
 * specific snapshot (e.g., the one just created).
 */
export function getLatestSnapshot(db: DbClient, projectId: string, excludeSnapshotId?: string) {
	const conditions = [eq(scoreSnapshots.projectId, projectId)];
	if (excludeSnapshotId) {
		conditions.push(sql`${scoreSnapshots.id} != ${excludeSnapshotId}`);
	}
	return db.query.scoreSnapshots.findFirst({
		where: and(...conditions),
		orderBy: desc(scoreSnapshots.createdAt),
	});
}

/**
 * Get the baseline snapshot for a project.
 */
export function getBaselineSnapshot(db: DbClient, projectId: string) {
	return db.query.scoreSnapshots.findFirst({
		where: and(
			eq(scoreSnapshots.projectId, projectId),
			eq(scoreSnapshots.snapshotType, "baseline"),
		),
	});
}

/**
 * Get all existing milestones for a project. Used to build the dedup
 * context for the milestone detection engine.
 */
export function getExistingMilestones(db: DbClient, projectId: string) {
	return db.query.roiMilestones.findMany({
		where: eq(roiMilestones.projectId, projectId),
		columns: {
			milestoneType: true,
			milestoneData: true,
		},
	});
}

/**
 * Insert a new milestone. Returns the inserted row.
 */
export function insertMilestone(
	db: DbClient,
	data: {
		projectId: string;
		milestoneType: MilestoneType;
		milestoneData: Record<string, unknown>;
		snapshotId: string | null;
	},
) {
	return db
		.insert(roiMilestones)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

// ─── ROI Report queries (#281) ──────────────────────────────

/**
 * Get all snapshots for a project, ordered chronologically (oldest first).
 * Used for the timeline chart in ROI reports.
 */
export function getSnapshotsForProject(db: DbClient, projectId: string) {
	return db.query.scoreSnapshots.findMany({
		where: eq(scoreSnapshots.projectId, projectId),
		orderBy: asc(scoreSnapshots.createdAt),
	});
}

/**
 * Get all milestones for a project, ordered chronologically.
 */
export function getMilestonesForProject(db: DbClient, projectId: string) {
	return db.query.roiMilestones.findMany({
		where: eq(roiMilestones.projectId, projectId),
		orderBy: asc(roiMilestones.triggeredAt),
	});
}

/**
 * Get citation records for a project, grouped by platform.
 */
export function getCitationsForProject(db: DbClient, projectId: string) {
	return db
		.select({
			platform: aiCitationTracking.platform,
			count: sql<number>`count(*)::int`,
		})
		.from(aiCitationTracking)
		.where(eq(aiCitationTracking.projectId, projectId))
		.groupBy(aiCitationTracking.platform);
}

/**
 * Insert a new ROI report record.
 */
export function createRoiReport(
	db: DbClient,
	data: {
		projectId: string;
		baselineSnapshotId: string | null;
		latestSnapshotId: string | null;
		reportData: typeof roiReports.$inferInsert.reportData;
		format: "pdf" | "html";
	},
) {
	return db
		.insert(roiReports)
		.values(data)
		.returning()
		.then((rows) => rows[0]);
}

/**
 * Get a ROI report by ID with project ownership info.
 */
export function getRoiReport(db: DbClient, reportId: string) {
	return db.query.roiReports.findFirst({
		where: eq(roiReports.id, reportId),
		with: {
			project: {
				columns: { id: true, name: true, websiteUrl: true },
			},
		},
	});
}

/**
 * List ROI reports for a project, newest first.
 * Used by the dashboard history table.
 */
export function getReportsForProject(db: DbClient, projectId: string) {
	return db.query.roiReports.findMany({
		where: eq(roiReports.projectId, projectId),
		orderBy: desc(roiReports.createdAt),
		columns: { id: true, createdAt: true, format: true, reportData: true },
	});
}

// ─── Comparison view queries (#307) ─────────────────────────

/**
 * Get a single snapshot by ID. Used by the comparison view to fetch
 * user-selected snapshots.
 */
export function getSnapshotById(db: DbClient, snapshotId: string) {
	return db.query.scoreSnapshots.findFirst({
		where: eq(scoreSnapshots.id, snapshotId),
	});
}

// ─── Portfolio Dashboard queries (#294) ────────────────────

export interface PortfolioProject {
	id: string;
	name: string;
	websiteUrl: string;
	currentScore: number;
	readinessLevel: number;
	scoreDelta: number;
	citationDelta: number;
	milestoneCount: number;
}

export interface PortfolioTimelinePoint {
	date: string;
	avgScore: number;
}

export interface PortfolioDashboardData {
	kpis: {
		avgScoreChange: number;
		avgCitationGrowth: number;
		totalMilestones: number;
		domainsWithDecline: number;
	};
	topImprovements: PortfolioProject[];
	bottomPerformers: PortfolioProject[];
	timeline: PortfolioTimelinePoint[];
	projects: PortfolioProject[];
	insufficientData: boolean;
}

/**
 * Aggregate portfolio dashboard data across all monitoring projects in the
 * instance. Returns KPIs, top/bottom performers, timeline, per-project stats.
 */
export async function getPortfolioDashboard(
	db: DbClient,
	periodDays = 30,
): Promise<PortfolioDashboardData> {
	// 1. Get all monitoring projects in the instance
	const projects = await db.query.monitoringProjects.findMany({
		columns: { id: true, name: true, websiteUrl: true },
	});

	if (projects.length === 0) {
		return {
			kpis: { avgScoreChange: 0, avgCitationGrowth: 0, totalMilestones: 0, domainsWithDecline: 0 },
			topImprovements: [],
			bottomPerformers: [],
			timeline: [],
			projects: [],
			insufficientData: true,
		};
	}

	const periodStart = new Date();
	periodStart.setDate(periodStart.getDate() - periodDays);

	// 2. For each project: get baseline + latest snapshot, count milestones
	const projectStats: PortfolioProject[] = [];
	let hasAnySnapshots = false;

	for (const project of projects) {
		const [baseline, latest, milestones] = await Promise.all([
			getBaselineSnapshot(db, project.id),
			getLatestSnapshot(db, project.id),
			db.query.roiMilestones.findMany({
				where: and(
					eq(roiMilestones.projectId, project.id),
					gte(roiMilestones.triggeredAt, periodStart),
				),
				columns: { id: true },
			}),
		]);

		if (latest) {
			hasAnySnapshots = true;
		}

		const currentScore = latest?.overallScore ?? 0;
		const readinessLevel = latest?.readinessLevel ?? 0;
		const scoreDelta = baseline && latest ? latest.overallScore - baseline.overallScore : 0;
		const citationDelta =
			baseline && latest ? (latest.aiCitationCount ?? 0) - (baseline.aiCitationCount ?? 0) : 0;

		projectStats.push({
			id: project.id,
			name: project.name,
			websiteUrl: project.websiteUrl,
			currentScore,
			readinessLevel,
			scoreDelta,
			citationDelta,
			milestoneCount: milestones.length,
		});
	}

	if (!hasAnySnapshots) {
		return {
			kpis: { avgScoreChange: 0, avgCitationGrowth: 0, totalMilestones: 0, domainsWithDecline: 0 },
			topImprovements: [],
			bottomPerformers: [],
			timeline: [],
			projects: projectStats,
			insufficientData: true,
		};
	}

	// 3. Compute KPIs
	const totalMilestones = projectStats.reduce((sum, p) => sum + p.milestoneCount, 0);
	const avgScoreChange =
		projectStats.length > 0
			? Math.round(
					(projectStats.reduce((sum, p) => sum + p.scoreDelta, 0) / projectStats.length) * 10,
				) / 10
			: 0;
	const avgCitationGrowth =
		projectStats.length > 0
			? Math.round(
					(projectStats.reduce((sum, p) => sum + p.citationDelta, 0) / projectStats.length) * 10,
				) / 10
			: 0;
	const domainsWithDecline = projectStats.filter((p) => p.scoreDelta < 0).length;

	// 4. Top 5 / Bottom 5
	const sorted = [...projectStats].sort((a, b) => b.scoreDelta - a.scoreDelta);
	const topImprovements = sorted.slice(0, 5);
	const bottomPerformers = sorted.slice(-5).reverse();

	// 5. Timeline: AVG(overall_score) per date across all projects
	const projectIds = projects.map((p) => p.id);
	const timelineRows = await db
		.select({
			date: sql<string>`to_char(${scoreSnapshots.createdAt}::date, 'YYYY-MM-DD')`,
			avgScore: sql<number>`round(avg(${scoreSnapshots.overallScore}))::int`,
		})
		.from(scoreSnapshots)
		.where(
			and(
				sql`${scoreSnapshots.projectId} = ANY(${projectIds})`,
				gte(scoreSnapshots.createdAt, periodStart),
			),
		)
		.groupBy(sql`${scoreSnapshots.createdAt}::date`)
		.orderBy(asc(sql`${scoreSnapshots.createdAt}::date`));

	const timeline: PortfolioTimelinePoint[] = timelineRows.map((r) => ({
		date: r.date,
		avgScore: r.avgScore,
	}));

	return {
		kpis: {
			avgScoreChange,
			avgCitationGrowth,
			totalMilestones,
			domainsWithDecline,
		},
		topImprovements,
		bottomPerformers,
		timeline,
		projects: projectStats,
		insufficientData: false,
	};
}
