import type {
	BrandingConfig,
	LevelScores,
	ReadinessLevel,
	ReportTexts,
	ScanCheck,
} from "@beacon/shared";

export interface ReportInput {
	url: string;
	finalUrl?: string;
	scannedAt: string;
	overallScore: number;
	readinessLevel: ReadinessLevel;
	levelScores: LevelScores;
	checks: ScanCheck[];
	reportTexts: ReportTexts;
	branding?: BrandingConfig;
}

// ── ROI Report Types (#281) ────────────────────────────────

export interface RoiSnapshotPoint {
	date: string;
	overallScore: number;
}

export interface RoiCitationChange {
	platform: string;
	before: number;
	after: number;
}

export interface RoiMilestoneEntry {
	milestoneType: string;
	description: string;
	triggeredAt: string;
}

export interface RoiReportInput {
	projectName: string;
	websiteUrl: string;
	periodStart: string;
	periodEnd: string;
	baselineScore: number;
	currentScore: number;
	scoreDelta: number;
	baselineLevel: number;
	currentLevel: number;
	subScoresBefore: LevelScores;
	subScoresAfter: LevelScores;
	snapshots: RoiSnapshotPoint[];
	citationChanges: RoiCitationChange[];
	milestones: RoiMilestoneEntry[];
	aiTexts?: {
		executiveSummary: string;
		recommendations: Array<{
			priority: number;
			title: string;
			description: string;
			impact: string;
		}>;
		outlook: string;
	};
	branding?: BrandingConfig;
	introText?: string;
}

export interface RoiReportOutput {
	html: string;
	pdf: Buffer;
	metadata: {
		generatedAt: string;
		pageCount: number;
		fileSizeBytes: number;
	};
}

export interface PdfOptions {
	format?: "A4" | "Letter";
	printBackground?: boolean;
}

export interface ReportOutput {
	html: string;
	pdf: Buffer;
	metadata: {
		generatedAt: string;
		pageCount: number;
		fileSizeBytes: number;
	};
}
