import type { CheckId } from "@beacon/shared";

// ── Job Data Interfaces ─────────────────────────────────────

export interface ScanJobData {
	scanId: string;
	url: string;
	/** Optional locale (#214). When set, scan persists locale_id and uses
	 *  locale-specific prompts via the renderer in @beacon/ai/prompts. */
	localeId?: string;
}

// CSV export job (#225)
export interface CsvExportJobData {
	exportId: string;
}

export interface CsvExportJobResult {
	exportId: string;
	rowCount: number;
	fileBytes: number;
}

export interface FixJobData {
	scanId: string;
	checkIds: CheckId[];
}

export interface ReportJobData {
	scanId: string;
	format: "pdf";
	regenerate?: boolean;
	branding?: {
		agencyName: string;
		primaryColor: string;
		accentColor: string;
		logoUrl?: string;
		footerText?: string;
		introText?: string;
	};
}

export interface AnalysisJobData {
	scanId: string;
	type: "semantic" | "citation";
}

// ── Job Result Interfaces ───────────────────────────────────

export interface ScanJobResult {
	scanId: string;
	overallScore: number;
	readinessLevel: number;
}

export interface FixJobResult {
	scanId: string;
	generatedCount: number;
}

export interface ReportJobResult {
	scanId: string;
	generatedAt: string;
	fileSizeBytes: number;
}

export interface AnalysisJobResult {
	scanId: string;
	analysisComplete: boolean;
}

export interface EmailJobData {
	emailLogId: string;
	to: string[];
	from: string;
	subject: string;
	html: string;
	text: string;
	headers?: Record<string, string>;
	tags?: string[];
}

export interface EmailJobResult {
	emailLogId: string;
	providerMessageId: string;
}

export interface PublicAuditJobData {
	requestId: string;
	url: string;
}

export interface PublicAuditJobResult {
	requestId: string;
	overallScore: number;
}

export interface AiVisibilityJobData {
	projectId: string;
	brandName: string;
	queryText: string;
	engines?: Array<"chatgpt" | "perplexity" | "gemini" | "claude">;
	/** Optional locale for locale-aware prompting (#479). When set, the
	 *  processor loads a locale-specific system prompt via
	 *  renderLocalePromptTemplate with a de-DE fallback per #199. Legacy
	 *  jobs enqueued before this field are handled gracefully. */
	localeId?: string;
}

export interface AiVisibilityJobResult {
	projectId: string;
	totalEngines: number;
	succeeded: number;
	failed: number;
	snapshotIds: string[];
	failedEngines: Array<{ engine: string; error: string }>;
	totalCostCents: number;
	mentionCount?: number;
	extractionFailures?: number;
	sentimentEnriched?: number;
	sentimentFallback?: number;
	sentimentCostCents?: number;
	rankingCount?: number;
	rankingFailures?: number;
	benchmarkCount?: number;
	benchmarkFailures?: number;
}

export interface LlmsTxtJobData {
	scanId: string;
	/** Bypass both idempotency layers and force a fresh insert. */
	force?: boolean;
}

export interface LlmsTxtJobResult {
	scanId: string;
	fixId: string;
	version: number;
	method: "ai-generated" | "template-fallback" | "cache-hit";
	costCents: number;
}

export interface JsonLdJobData {
	scanId: string;
	/** Bypass both idempotency layers and force a fresh insert. */
	force?: boolean;
}

export interface JsonLdJobResult {
	scanId: string;
	fixId: string;
	version: number;
	method: "ai-generated" | "template-fallback" | "cache-hit";
	costCents: number;
}

export interface AgentsMdJobData {
	scanId: string;
	/** Bypass both idempotency layers and force a fresh insert. */
	force?: boolean;
}

export interface AgentsMdJobResult {
	scanId: string;
	fixId: string;
	version: number;
	method: "ai-generated" | "template-fallback" | "cache-hit";
	costCents: number;
}

export interface RoiReportJobData {
	projectId: string;
	format: "pdf";
	branding?: {
		agencyName: string;
		primaryColor: string;
		accentColor: string;
		logoUrl?: string;
		footerText?: string;
		introText?: string;
	};
}

export interface RoiReportJobResult {
	reportId: string;
	projectId: string;
	generatedAt: string;
	fileSizeBytes: number;
}

export interface RollbackJobData {
	deploymentAttemptId: string;
	triggeredBy: string;
}

export interface RollbackJobResult {
	deploymentAttemptId: string;
	rolledBack: boolean;
}

export interface DeployJobData {
	fixId: string;
	cmsConnectionId: string;
	deploymentAttemptId: string;
}

export interface DeployJobResult {
	deploymentAttemptId: string;
	deployed: boolean;
	rollbackData?: unknown;
}

export interface ValidateDeploymentJobData {
	deploymentAttemptId: string;
	fixId: string;
	fixType: string;
	expectedContent: string;
	siteUrl: string;
}

export interface ValidateDeploymentJobResult {
	deploymentAttemptId: string;
	status: string;
	validationId: string;
}

export interface CitationExtractionJobData {
	auditId: string;
	modelName: string;
	queryText: string;
	rawResponse: string;
	/** Optional site crawl so extracted URLs matching crawled pages can be linked. */
	crawlId?: string;
}

export interface CitationExtractionJobResult {
	citationId: string;
	citationsExtracted: number;
	citedPagesUpserted: number;
	mappingsCreated: number;
	/** True if this job found an already-processed citation and skipped re-extraction. */
	skippedAsIdempotent: boolean;
}

// ── Type Maps ───────────────────────────────────────────────

export interface JobDataMap {
	scan: ScanJobData;
	fix: FixJobData;
	report: ReportJobData;
	analysis: AnalysisJobData;
	email: EmailJobData;
	"public-audit": PublicAuditJobData;
	"ai-visibility": AiVisibilityJobData;
	"llms-txt": LlmsTxtJobData;
	"json-ld": JsonLdJobData;
	"agents-md": AgentsMdJobData;
	"roi-report": RoiReportJobData;
	rollback: RollbackJobData;
	deploy: DeployJobData;
	"validate-deployment": ValidateDeploymentJobData;
	"citation-extraction": CitationExtractionJobData;
	"csv-export": CsvExportJobData;
}

export interface JobResultMap {
	scan: ScanJobResult;
	fix: FixJobResult;
	report: ReportJobResult;
	analysis: AnalysisJobResult;
	email: EmailJobResult;
	"public-audit": PublicAuditJobResult;
	"ai-visibility": AiVisibilityJobResult;
	"llms-txt": LlmsTxtJobResult;
	"json-ld": JsonLdJobResult;
	"agents-md": AgentsMdJobResult;
	"roi-report": RoiReportJobResult;
	rollback: RollbackJobResult;
	deploy: DeployJobResult;
	"validate-deployment": ValidateDeploymentJobResult;
	"citation-extraction": CitationExtractionJobResult;
	"csv-export": CsvExportJobResult;
}

export type QueueName = keyof JobDataMap;
