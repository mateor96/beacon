import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
	aiCompetitorBenchmarks,
	aiMentions,
	aiRankings,
	aiSentimentScores,
	aiSnapshots,
	aiSourceAttributions,
} from "./schema/ai-visibility";
import type { alertEvents, alerts } from "./schema/alerts";
import type { anonymousScans } from "./schema/anonymous-scans";
import type { apiKeys } from "./schema/api-keys";
import type { benchmarkGroups } from "./schema/benchmarks";
import type { competitors } from "./schema/competitors";
import type { siteCrawlPages, siteCrawls } from "./schema/crawls";
import type { deadLetterJobs } from "./schema/dead-letter-jobs";
import type { emailLog, userEmailPreferences } from "./schema/email";
import type {
	monitoringProjects,
	monitoringPrompts,
	monitoringResults,
	monitoringSchedules,
} from "./schema/monitoring";
import type { profiles } from "./schema/profiles";
import type {
	publicAuditRequests,
	publicAuditResults,
	publicConversionEvents,
	publicLeads,
} from "./schema/public-audit";
import type { aiCitationTracking, roiMilestones, roiReports, scoreSnapshots } from "./schema/roi";
import type { scans } from "./schema/scans";
import type { waitlistSignups } from "./schema/waitlist";

// Profiles
export type Profile = InferSelectModel<typeof profiles>;
export type NewProfile = InferInsertModel<typeof profiles>;

// Scans
export type Scan = InferSelectModel<typeof scans>;
export type NewScan = InferInsertModel<typeof scans>;

// Anonymous Scans
export type AnonymousScan = InferSelectModel<typeof anonymousScans>;
export type NewAnonymousScan = InferInsertModel<typeof anonymousScans>;

// Monitoring
export type MonitoringProject = InferSelectModel<typeof monitoringProjects>;
export type NewMonitoringProject = InferInsertModel<typeof monitoringProjects>;

export type MonitoringPrompt = InferSelectModel<typeof monitoringPrompts>;
export type NewMonitoringPrompt = InferInsertModel<typeof monitoringPrompts>;

export type MonitoringResult = InferSelectModel<typeof monitoringResults>;
export type NewMonitoringResult = InferInsertModel<typeof monitoringResults>;

export type MonitoringSchedule = InferSelectModel<typeof monitoringSchedules>;
export type NewMonitoringSchedule = InferInsertModel<typeof monitoringSchedules>;

// Crawls
export type SiteCrawl = InferSelectModel<typeof siteCrawls>;
export type NewSiteCrawl = InferInsertModel<typeof siteCrawls>;

export type SiteCrawlPage = InferSelectModel<typeof siteCrawlPages>;
export type NewSiteCrawlPage = InferInsertModel<typeof siteCrawlPages>;

// Benchmarks
export type BenchmarkGroup = InferSelectModel<typeof benchmarkGroups>;
export type NewBenchmarkGroup = InferInsertModel<typeof benchmarkGroups>;

// Alerts
export type Alert = InferSelectModel<typeof alerts>;
export type NewAlert = InferInsertModel<typeof alerts>;

export type AlertEvent = InferSelectModel<typeof alertEvents>;
export type NewAlertEvent = InferInsertModel<typeof alertEvents>;

// API Keys
export type ApiKey = InferSelectModel<typeof apiKeys>;
export type NewApiKey = InferInsertModel<typeof apiKeys>;

// Waitlist
export type WaitlistSignup = InferSelectModel<typeof waitlistSignups>;
export type NewWaitlistSignup = InferInsertModel<typeof waitlistSignups>;

// Dead Letter Jobs
export type DeadLetterJob = InferSelectModel<typeof deadLetterJobs>;
export type NewDeadLetterJob = InferInsertModel<typeof deadLetterJobs>;

// Email
export type EmailLog = InferSelectModel<typeof emailLog>;
export type NewEmailLog = InferInsertModel<typeof emailLog>;

export type UserEmailPreference = InferSelectModel<typeof userEmailPreferences>;
export type NewUserEmailPreference = InferInsertModel<typeof userEmailPreferences>;

// Public Audit
export type PublicAuditRequest = InferSelectModel<typeof publicAuditRequests>;
export type NewPublicAuditRequest = InferInsertModel<typeof publicAuditRequests>;

export type PublicAuditResult = InferSelectModel<typeof publicAuditResults>;
export type NewPublicAuditResult = InferInsertModel<typeof publicAuditResults>;

export type PublicLead = InferSelectModel<typeof publicLeads>;
export type NewPublicLead = InferInsertModel<typeof publicLeads>;

export type PublicConversionEvent = InferSelectModel<typeof publicConversionEvents>;
export type NewPublicConversionEvent = InferInsertModel<typeof publicConversionEvents>;

// AI Visibility
export type AiSnapshot = InferSelectModel<typeof aiSnapshots>;
export type NewAiSnapshot = InferInsertModel<typeof aiSnapshots>;

export type AiMention = InferSelectModel<typeof aiMentions>;
export type NewAiMention = InferInsertModel<typeof aiMentions>;

export type AiRanking = InferSelectModel<typeof aiRankings>;
export type NewAiRanking = InferInsertModel<typeof aiRankings>;

export type AiSentimentScore = InferSelectModel<typeof aiSentimentScores>;
export type NewAiSentimentScore = InferInsertModel<typeof aiSentimentScores>;

export type AiSourceAttribution = InferSelectModel<typeof aiSourceAttributions>;
export type NewAiSourceAttribution = InferInsertModel<typeof aiSourceAttributions>;

export type AiCompetitorBenchmark = InferSelectModel<typeof aiCompetitorBenchmarks>;
export type NewAiCompetitorBenchmark = InferInsertModel<typeof aiCompetitorBenchmarks>;

// Competitors
export type Competitor = InferSelectModel<typeof competitors>;
export type NewCompetitor = InferInsertModel<typeof competitors>;

// ROI Tracking (use Record suffix to avoid collision with @beacon/shared's ScoreSnapshot)
export type ScoreSnapshotRecord = InferSelectModel<typeof scoreSnapshots>;
export type NewScoreSnapshotRecord = InferInsertModel<typeof scoreSnapshots>;

export type RoiReport = InferSelectModel<typeof roiReports>;
export type NewRoiReport = InferInsertModel<typeof roiReports>;

export type RoiMilestone = InferSelectModel<typeof roiMilestones>;
export type NewRoiMilestone = InferInsertModel<typeof roiMilestones>;

export type AiCitationTrack = InferSelectModel<typeof aiCitationTracking>;
export type NewAiCitationTrack = InferInsertModel<typeof aiCitationTracking>;
