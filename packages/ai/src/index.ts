export const AI_VERSION = "0.1.0" as const;

// Types
export type {
	AiResult,
	AiError,
	SemanticAnalysisResult,
	CitationAnalysisResult,
	SemanticDimension,
	ClaudeClientConfig,
	RetryConfig,
} from "./types.js";
export { DEFAULT_RETRY_CONFIG } from "./types.js";

// Client
export { ClaudeClient, createClient } from "./client.js";

// Validators
export {
	ScoreSchema,
	DimensionSchema,
	SemanticAnalysisSchema,
	CitationAnalysisSchema,
	GeneratedFixSchema,
	ReportTextsSchema,
	RoiReportTextsSchema,
	parseAiOutput,
} from "./schemas.js";
export type {
	ValidatedSemanticAnalysis,
	ValidatedCitationAnalysis,
	ValidatedGeneratedFix,
	ValidatedReportTexts,
	ValidatedRoiReportTexts,
} from "./schemas.js";

// Retry
export { withValidatedRetry, stripJsonFences } from "./retry.js";

// Analysis Pipeline
export {
	analyzeSemanticQuality,
	analyzeCitationReadiness,
	buildSemanticPrompt,
	buildCitationPrompt,
} from "./pipeline.js";
export type { AnalyzeOptions } from "./pipeline.js";

// Report Text Generation
export { generateReportTexts } from "./report-texts.js";

// ROI Report Text Generation (#281)
export { generateRoiReportTexts } from "./roi-report-texts.js";
export type { RoiReportTextInput } from "./roi-report-texts.js";

// Fix Generators
export { generateFix } from "./generators/index.js";
export type { FixGeneratorContext } from "./generators/index.js";

// llms.txt generator (#233) — writes versioned rows into generated_fixes
export {
	generateLlmsTxt,
	renderLlmsTxtTemplate,
	validateLlmsTxt,
	computeLlmsTxtInputHash,
	LLMS_TXT_PROMPT_VERSION,
} from "./generators/llms-txt.js";
export type {
	GenerateLlmsTxtInput,
	GenerateLlmsTxtResult,
	GenerationMethod,
	LlmsCheckSummary,
} from "./generators/llms-txt.js";

// Schema.org / JSON-LD generator (#240) — writes versioned rows into generated_fixes
export {
	generateSchemaOrg,
	renderSchemaOrgTemplate,
	validateJsonLd,
	computeSchemaOrgInputHash,
	SCHEMA_ORG_PROMPT_VERSION,
} from "./generators/schema-org.js";
export type {
	GenerateSchemaOrgInput,
	GenerateSchemaOrgResult,
	SchemaOrgCheckSummary,
} from "./generators/schema-org.js";

// AGENTS.md generator (#247) — writes versioned rows into generated_fixes
export {
	generateAgentsMd,
	renderAgentsMdTemplate,
	validateAgentsMd,
	computeAgentsMdInputHash,
	AGENTS_MD_PROMPT_VERSION,
} from "./generators/agents-md.js";
export type {
	GenerateAgentsMdInput,
	GenerateAgentsMdResult,
	AgentsMdCheckSummary,
	RobotsTxtCheckSummary,
} from "./generators/agents-md.js";

// Sentiment Analysis
export { classifySentimentBatch, SentimentBatchResponseSchema } from "./sentiment/index.js";
export type { SentimentInput, SentimentBatchResult } from "./sentiment/index.js";

// Source Attribution Extraction (#188)
export { extractSources } from "./extraction/source-extractor.js";
export type {
	SourceAttributionKind,
	ExtractedSource,
	SourceExtractionInput,
	SourceExtractionReport,
} from "./extraction/source-extractor.js";

// Locale-aware prompt template engine (#199) + language pack (#206)
export { LANGUAGE_PACK } from "./prompts/index.js";
export type { LocalePack } from "./prompts/index.js";
export {
	TEMPLATE_PLACEHOLDER_RE,
	UnresolvedPlaceholdersError,
	buildLocaleVariables,
	findUnresolvedPlaceholders,
	renderAndValidate,
	renderLocalePromptTemplate,
	renderTemplate,
	resolveLocalePromptTemplate,
} from "./prompts/index.js";
export type {
	ResolveTemplateOptions,
	ResolvedPromptTemplate,
	TemplateVariables,
} from "./prompts/index.js";

// AI-suggested monitoring prompts (#203)
export {
	generateSuggestedPrompts,
	parseLlmResponse,
	renderFallbackTemplates,
	listSupportedIndustries,
	getIndustryTemplates,
} from "./suggestions/index.js";
export type {
	GenerateSuggestedPromptsInput,
	PromptLlmClient,
	SuggestedPrompt,
	SupportedIndustry,
	SupportedLanguage,
	IndustryPromptTemplate,
} from "./suggestions/index.js";

// Multi-Provider Query
export type {
	AiEngine,
	AiHealthCheckResult,
	AiQueryResult,
	AiQueryProvider,
} from "./providers/index.js";
export {
	createConfiguredProviders,
	calculateCostCents,
	ClaudeProvider,
	ChatGptProvider,
	PerplexityProvider,
	GeminiProvider,
} from "./providers/index.js";
