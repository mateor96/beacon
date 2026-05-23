// ── Const Arrays ──────────────────────────────────────────────

export const CHECK_IDS = [
	"llms-txt",
	"robots-txt",
	"sitemap-xml",
	"schema-org",
	"content-structure",
	"performance",
	"meta-tags",
	"webmcp",
	"agents-md",
	"semantic-quality",
	"citation-readiness",
	"content-freshness",
	"faq-schema",
	"js-rendering",
] as const;

export type CheckId = (typeof CHECK_IDS)[number];

export const FIX_GENERATOR_IDS = [
	"llms-txt",
	"schema-org",
	"agents-md",
	"robots-txt",
	"meta-tags",
] as const;

export type FixGeneratorId = (typeof FIX_GENERATOR_IDS)[number];

export const PLAN_NAMES = ["free", "starter", "pro", "agency", "enterprise"] as const;

export type PlanName = (typeof PLAN_NAMES)[number];

// ── Type Unions ──────────────────────────────────────────────

export type CheckCategory = "readability" | "interactivity" | "transactional";

export type CheckSeverity = "critical" | "important" | "nice-to-have";

export type CheckStatus = "pass" | "warn" | "fail" | "info" | "error";

export type ScanStatus = "pending" | "processing" | "completed" | "failed";

export type ReadinessLevel = 0 | 1 | 2 | 3;

export type ReadinessLevelName = "Unsichtbar" | "Lesbar" | "Strukturiert" | "Optimiert";

// ── Interfaces ───────────────────────────────────────────────

export interface ScanCheckIssue {
	message: string;
	severity: CheckSeverity;
	context?: string;
}

export interface ScanCheck {
	id: CheckId;
	name: string;
	status: CheckStatus;
	category: CheckCategory;
	severity: CheckSeverity;
	score: number;
	summary: string;
	issues: ScanCheckIssue[];
	details?: Record<string, unknown>;
}

/** Result of a centrally prefetched sub-resource (e.g. /robots.txt). */
export interface PrefetchedResource {
	/** Raw body content. */
	content: string;
	/** HTTP status code. */
	statusCode: number;
	/** The path that yielded the content (e.g. "/llms-full.txt"). */
	source: string;
}

export interface CheckContext {
	/** The original URL as entered by the user, before any redirects. */
	inputUrl: string;
	/** The URL after following all redirects. Use this for sub-resource fetches (e.g., /robots.txt). */
	finalUrl: string;
	html: string;
	parsedHtml: unknown;
	responseTime: number;
	statusCode: number;
	/** Ordered redirect target URLs. Empty when no redirects occurred. */
	redirects: string[];
	/** Centrally prefetched sub-resources, keyed by path. null = not found. */
	subResources: Record<string, PrefetchedResource | null>;
}

export interface CheckPlugin {
	id: CheckId;
	name: string;
	category: CheckCategory;
	severity: CheckSeverity;
	run: (ctx: CheckContext) => Promise<ScanCheck>;
}

export interface LevelScores {
	readability: number | null;
	interactivity: number | null;
	transactional: number | null;
}

export interface CheckScoreEntry {
	checkId: CheckId;
	score: number;
	weight: number;
	weightedScore: number;
}

export interface ScoreBreakdown {
	overallScore: number;
	readinessLevel: ReadinessLevel;
	levelScores: LevelScores;
	checks: CheckScoreEntry[];
	totalWeight: number;
	currentReadiness?: number;
	futureReadiness?: number;
}

export interface ScanResult {
	id: string;
	/** The original URL as entered by the user. */
	url: string;
	/** The URL after following all redirects. Undefined only for failed scans. */
	finalUrl?: string;
	status: ScanStatus;
	overallScore: number;
	readinessLevel: ReadinessLevel;
	levelScores: LevelScores;
	checks: ScanCheck[];
	/** ISO-8601 string. Maps to DB column `scans.scanned_at` (timestamptz) via `.toISOString()`. */
	createdAt: string;
	/** ISO-8601 string. Maps to DB column `scans.updated_at` (timestamptz) via `.toISOString()`. */
	completedAt?: string;
	error?: string;
	currentReadiness?: number;
	futureReadiness?: number;
}

export interface GeneratedFix {
	checkId: FixGeneratorId;
	content: string;
	filename: string;
	method: "rule-based" | "ai-generated" | "hybrid";
}

// ── AI Types ────────────────────────────────────────────────

export const AI_MODELS = ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const AI_OPERATION_TYPES = [
	"semantic-analysis",
	"citation-analysis",
	"fix-generation",
	"report-generation",
	"sentiment-analysis",
	"roi-recommendation",
] as const;
export type AiOperationType = (typeof AI_OPERATION_TYPES)[number];

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	model: AiModel;
	operation: AiOperationType;
	durationMs: number;
}

// ── Report Types ────────────────────────────────────────────

export interface ReportTexts {
	executiveSummary: string;
	checkSummaries: Partial<Record<CheckId, string>>;
	categoryAssessments: {
		readability: string;
		interactivity: string;
		transactional?: string;
	};
	recommendations: string[];
	conclusion: string;
}

export interface BrandingConfig {
	agencyName: string;
	primaryColor: string;
	secondaryColor?: string;
	accentColor: string;
	logoUrl?: string;
	footerText?: string;
	introText?: string;
	contactName?: string;
	contactEmail?: string;
	contactPhone?: string;
	contactWebsite?: string;
}

// ── Comparison Types ────────────────────────────────────────

export interface ComparisonCheckEntry {
	checkId: CheckId;
	primaryScore: number;
	competitorScore: number;
	delta: number;
	result: "won" | "lost" | "tied";
}

export interface ComparisonCategoryEntry {
	category: CheckCategory;
	primaryScore: number | null;
	competitorScore: number | null;
	delta: number;
	result: "won" | "lost" | "tied";
}

export interface ComparisonSummary {
	primaryOverallScore: number;
	competitorOverallScore: number;
	overallDelta: number;
	checksWon: number;
	checksLost: number;
	checksTied: number;
}

export interface ComparisonResult {
	checkEntries: ComparisonCheckEntry[];
	categoryEntries: ComparisonCategoryEntry[];
	summary: ComparisonSummary;
}

// ── Snapshot Types ───────────────────────────────────────────

export const SNAPSHOT_TYPES = ["manual", "scheduled", "baseline"] as const;
export type SnapshotType = (typeof SNAPSHOT_TYPES)[number];

export interface ScoreSnapshot {
	/** Unique snapshot identifier (UUID). */
	id: string;
	/** Domain this snapshot belongs to. */
	domainId: string;
	/** Scan that produced these scores. */
	scanId: string;
	/** How this snapshot was triggered. */
	type: SnapshotType;
	/** Full score breakdown at capture time. */
	scores: ScoreBreakdown;
	/** ISO-8601 timestamp when the snapshot was captured. */
	capturedAt: string;
	/** Schema version for forward compatibility. Starts at 1. */
	version: number;
}

export type DeltaDirection = "improved" | "regressed" | "unchanged";

export interface SnapshotCheckDelta {
	checkId: CheckId;
	before: number;
	after: number;
	delta: number;
	/** ((after - before) / before) * 100. null when before is 0. */
	percentageChange: number | null;
	direction: DeltaDirection;
}

export interface SnapshotDelta {
	beforeSnapshotId: string;
	afterSnapshotId: string;
	overallDelta: number;
	/** Percentage change for overall score. null when before is 0. */
	overallPercentageChange: number | null;
	readinessLevelDelta: number;
	levelScoreDeltas: {
		readability: number | null;
		interactivity: number | null;
		transactional: number | null;
	};
	checkDeltas: SnapshotCheckDelta[];
	currentReadinessDelta: number;
	futureReadinessDelta: number;
	/** Checks present in 'after' but not 'before'. */
	addedChecks: CheckId[];
	/** Checks present in 'before' but not 'after'. */
	removedChecks: CheckId[];
	direction: DeltaDirection;
}

// ── Fix Generation & Deployment (#223) ───────────────────────

/**
 * Plaintext CMS credentials, discriminated by `cms` so each platform's
 * required auth fields are statically enforced. Stored only inside the
 * AES-256-GCM envelope on `cms_connections.encrypted_credentials`.
 *
 * Never log instances of this type. Never persist outside the envelope.
 */
export type CmsCredentialsPlaintext =
	| { cms: "wordpress"; baseUrl: string; username: string; appPassword: string }
	| { cms: "webflow"; siteId: string; apiToken: string }
	| { cms: "shopify"; shopDomain: string; accessToken: string; apiVersion: string };

/**
 * Snapshot of the CMS state captured immediately before a deployment so it
 * can be reversed by the rollback worker. Stored as JSONB on
 * `deployment_attempts.rollback_data`. Discriminated by `cms` to mirror
 * the platform-specific deployment paths.
 */
export type RollbackPayload =
	| {
			cms: "wordpress";
			strategy: "restore_field" | "delete_file";
			postId?: number;
			filePath?: string;
			previousContent?: string;
			previousMeta?: Record<string, string>;
			capturedAt: string;
	  }
	| {
			cms: "webflow";
			strategy: "restore_field";
			collectionId: string;
			itemId: string;
			previousFields: Record<string, unknown>;
			capturedAt: string;
	  }
	| {
			cms: "shopify";
			strategy: "restore_theme_asset";
			themeId: number;
			assetKey: string;
			previousValue: string;
			capturedAt: string;
	  };
