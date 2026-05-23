import * as _profiles from "./profiles";

export const profileQueries = {
	getById: _profiles.getById,
	create: _profiles.create,
	ensureProfile: _profiles.ensureProfile,
	getBranding: _profiles.getBranding,
	updateBranding: _profiles.updateBranding,
};

export * as scanQueries from "./scans";
export * as anonymousScanQueries from "./anonymous-scans";
export * as monitoringQueries from "./monitoring";
export * as crawlQueries from "./crawls";
export * as benchmarkQueries from "./benchmarks";
export * as alertQueries from "./alerts";
export * as cleanupQueries from "./cleanup";
export * as waitlistQueries from "./waitlist";
export * as deadLetterJobQueries from "./dead-letter-jobs";
export * as emailQueries from "./email";
export * as publicAuditQueries from "./public-audit";
export * as aiVisibilityQueries from "./ai-visibility";
export * as competitorQueries from "./competitors";
export * as fixQueries from "./fixes";
export * as roiQueries from "./roi";
export * as citationQueries from "./citations";
export * as competitiveQueries from "./competitive";
export * as localeQueries from "./locales";
export * as redditQueries from "./reddit";
export * as csvExportQueries from "./csv-exports";
export * as reportShareQueries from "./report-shares";
export * as webhookQueries from "./webhooks";
