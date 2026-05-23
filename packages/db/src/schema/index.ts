// Tables
export { profiles } from "./profiles";
export { scans } from "./scans";
export { anonymousScans } from "./anonymous-scans";
export {
	monitoringProjects,
	monitoringPrompts,
	monitoringResults,
	monitoringSchedules,
} from "./monitoring";
export { siteCrawls, siteCrawlPages } from "./crawls";
export { benchmarkGroups } from "./benchmarks";
export { alerts, alertEvents } from "./alerts";
export { waitlistSignups } from "./waitlist";
export { deadLetterJobs } from "./dead-letter-jobs";
export { emailLog, userEmailPreferences } from "./email";
export {
	publicAuditRequests,
	publicAuditResults,
	publicLeads,
	publicConversionEvents,
} from "./public-audit";
export { competitors } from "./competitors";
export {
	COMPETITOR_SCAN_STATUSES,
	TREND_DIRECTIONS,
	competitorScanResults,
	competitorScoreHistory,
	competitorScanResultsRelations,
	competitorScoreHistoryRelations,
} from "./competitive";
export type {
	CompetitorScanStatus,
	TrendDirection,
	CompetitorScanResult,
	NewCompetitorScanResult,
	CompetitorScoreHistory,
	NewCompetitorScoreHistory,
} from "./competitive";
export {
	FIX_TYPES,
	FIX_STATUSES,
	DEPLOYMENT_STATUSES,
	CMS_TYPES,
	VALIDATION_STATUSES,
	generatedFixes,
	cmsConnections,
	deploymentAttempts,
	fixValidations,
	generatedFixesRelations,
	cmsConnectionsRelations,
	deploymentAttemptsRelations,
	fixValidationsRelations,
} from "./fixes";
export type {
	FixType,
	FixStatus,
	DeploymentStatus,
	CmsType,
	ValidationStatus,
} from "./fixes";

export {
	MILESTONE_TYPES,
	ROI_REPORT_FORMATS,
	scoreSnapshots,
	roiReports,
	roiMilestones,
	aiCitationTracking,
	scoreSnapshotsRelations,
	roiReportsRelations,
	roiMilestonesRelations,
	aiCitationTrackingRelations,
} from "./roi";
export type { MilestoneType, RoiReportFormat } from "./roi";

export {
	AI_ENGINES,
	SENTIMENT_VALUES,
	MENTION_TYPES,
	SOURCE_ATTRIBUTION_TYPES,
	aiSnapshots,
	aiMentions,
	aiRankings,
	aiSentimentScores,
	aiSourceAttributions,
	aiCompetitorBenchmarks,
} from "./ai-visibility";
export type { SourceAttributionType } from "./ai-visibility";

// Relations
export { profilesRelations, scansRelations } from "./relations";
export {
	monitoringProjectsRelations,
	monitoringPromptsRelations,
	monitoringResultsRelations,
	monitoringSchedulesRelations,
} from "./monitoring";
export { siteCrawlsRelations, siteCrawlPagesRelations } from "./crawls";
export { benchmarkGroupsRelations } from "./benchmarks";
export { alertsRelations, alertEventsRelations } from "./alerts";
export { emailLogRelations, userEmailPreferencesRelations } from "./email";
export {
	publicAuditRequestsRelations,
	publicAuditResultsRelations,
	publicLeadsRelations,
	publicConversionEventsRelations,
} from "./public-audit";
export { competitorsRelations } from "./competitors";
export {
	aiSnapshotsRelations,
	aiMentionsRelations,
	aiRankingsRelations,
	aiSentimentScoresRelations,
	aiSourceAttributionsRelations,
	aiCompetitorBenchmarksRelations,
} from "./ai-visibility";

export {
	CITATION_MATCH_TYPES,
	CITATION_SNAPSHOT_TYPES,
	citations,
	citedPages,
	citationPageMappings,
	citationSnapshots,
	citationUrlAliases,
	citationsRelations,
	citedPagesRelations,
	citationPageMappingsRelations,
	citationSnapshotsRelations,
	citationUrlAliasesRelations,
} from "./citations";
export type {
	CitationMatchType,
	CitationSnapshotType,
	Citation,
	NewCitation,
	CitedPage,
	NewCitedPage,
	CitationPageMapping,
	NewCitationPageMapping,
	CitationSnapshot,
	NewCitationSnapshot,
	CitationUrlAlias,
	NewCitationUrlAlias,
} from "./citations";

export {
	locales,
	domainLocales,
	promptTemplates,
	localesRelations,
	domainLocalesRelations,
	promptTemplatesRelations,
} from "./locales";
export type {
	Locale,
	NewLocale,
	DomainLocale,
	NewDomainLocale,
	PromptTemplate,
	NewPromptTemplate,
} from "./locales";

export {
	CSV_EXPORT_STATUSES,
	CSV_EXPORT_ENTITIES,
	csvExports,
} from "./csv-exports";
export type { CsvExportStatus, CsvExportEntity, CsvExport, NewCsvExport } from "./csv-exports";

export { reportShares, reportSharesRelations } from "./report-shares";
export type { ReportShare, NewReportShare } from "./report-shares";

export {
	REDDIT_SENTIMENT_VALUES,
	REDDIT_MENTION_TYPES,
	redditPosts,
	redditComments,
	redditMentionBrands,
	redditAiCitationLinks,
	redditSubredditMeta,
	redditPostsRelations,
	redditCommentsRelations,
	redditMentionBrandsRelations,
	redditAiCitationLinksRelations,
} from "./reddit";
export type {
	RedditSentiment,
	RedditMentionType,
	RedditPost,
	NewRedditPost,
	RedditComment,
	NewRedditComment,
	RedditMentionBrand,
	NewRedditMentionBrand,
	RedditAiCitationLink,
	NewRedditAiCitationLink,
	RedditSubredditMeta,
	NewRedditSubredditMeta,
} from "./reddit";
