// Type-only re-exports (erased at runtime)
export type {
	CheckId,
	FixGeneratorId,
	CheckCategory,
	CheckSeverity,
	CheckStatus,
	ScanStatus,
	ReadinessLevel,
	ReadinessLevelName,
	PlanName,
	ScanCheckIssue,
	ScanCheck,
	CheckContext,
	PrefetchedResource,
	CheckPlugin,
	LevelScores,
	ScanResult,
	GeneratedFix,
	TokenUsage,
	AiModel,
	AiOperationType,
	ReportTexts,
	BrandingConfig,
	CheckScoreEntry,
	ScoreBreakdown,
	ComparisonCheckEntry,
	ComparisonCategoryEntry,
	ComparisonSummary,
	ComparisonResult,
	SnapshotType,
	ScoreSnapshot,
	DeltaDirection,
	SnapshotCheckDelta,
	SnapshotDelta,
	CmsCredentialsPlaintext,
	RollbackPayload,
} from "./types.js";

// Runtime values from types
export {
	CHECK_IDS,
	FIX_GENERATOR_IDS,
	PLAN_NAMES,
	AI_MODELS,
	AI_OPERATION_TYPES,
	SNAPSHOT_TYPES,
} from "./types.js";

// Constants (all runtime)
export {
	SEVERITY_POINTS,
	LEVEL_THRESHOLDS,
	LEVEL_NAMES,
	CHECK_REGISTRY,
	CHECK_METADATA_MAP,
	CHECK_WEIGHTS,
	CURRENT_READINESS_CHECK_IDS,
	FUTURE_READINESS_CHECK_IDS,
	LEVEL_GATE_CHECKS,
	AI_CRAWLERS,
	MAX_SCORE,
	scoreToLevel,
	PLAN_RETENTION_DAYS,
	HTML_CONTENT_RETENTION_HOURS,
	ANONYMOUS_SCAN_DAILY_LIMIT,
} from "./constants.js";
export type { CheckMetadata, AICrawler } from "./constants.js";

// Validation (all runtime)
export {
	UrlSchema,
	UuidSchema,
	PlanNameSchema,
	CheckIdSchema,
	FixGeneratorIdSchema,
	ScanRequestSchema,
	FixRequestSchema,
	PaginationSchema,
	AnalysisTypeSchema,
	AnalyzeRequestSchema,
	WaitlistSignupSchema,
	BrandingConfigSchema,
	ReportRequestSchema,
	ComparisonRequestSchema,
	isDisposableEmail,
	SafeEmailSchema,
	UnlockRequestSchema,
	ConversionEventSchema,
	SentimentOverrideSchema,
	CmsTypeSchema,
	CMS_TYPE_VALUES,
	CreateWordPressConnectionSchema,
	CreateShopifyConnectionSchema,
	CreateCmsConnectionSchema,
	DeployRequestSchema,
	MonitoringProjectCreateSchema,
	ScheduleFrequencySchema,
	MonitoringScheduleCreateSchema,
	MonitoringScheduleUpdateSchema,
	CompetitorCreateSchema,
} from "./validation.js";
export type {
	ValidUrl,
	ValidUuid,
	ScanRequest,
	FixRequest,
	Pagination,
	AnalyzeRequest,
	BrandingConfigInput,
	ReportRequest,
	WaitlistSignupRequest,
	ComparisonRequest,
	UnlockRequest,
	ConversionEvent,
	SentimentOverrideRequest,
	CreateCmsConnectionRequest,
	DeployRequest,
	MonitoringProjectCreateInput,
	ScheduleFrequency,
	MonitoringScheduleCreateInput,
	MonitoringScheduleUpdateInput,
	CompetitorCreateInput,
} from "./validation.js";

// Deployment state machine (#291)
export {
	VALID_DEPLOYMENT_TRANSITIONS,
	isValidDeploymentTransition,
	assertValidDeploymentTransition,
	isTerminalDeploymentStatus,
} from "./deployment-state-machine.js";
export type { DeploymentStatus } from "./deployment-state-machine.js";

// Snapshot comparison (#307)
export { computeSnapshotComparison } from "./snapshot-comparison.js";
export type {
	ComparisonDirection,
	SubScoreDelta,
	SnapshotComparisonResult,
	ComparableSnapshot,
} from "./snapshot-comparison.js";

// Utilities
export { isHtmlResponse } from "./utils.js";
