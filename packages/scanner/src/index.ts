export const SCANNER_VERSION = "0.1.0" as const;

// Core classes
export { ScannerEngine } from "./scanner.js";
export type { ScanOptions } from "./scanner.js";
export { CheckRegistry, defaultRegistry } from "./registry.js";

// Scoring
export {
	calculateOverallScore,
	calculateLevelScores,
	calculateReadinessLevel,
	calculateScoreBreakdown,
	calculateCurrentReadiness,
	calculateFutureReadiness,
	calculateComparison,
} from "./scoring.js";

// Snapshots
export { captureSnapshot, compareSnapshots } from "./snapshot.js";

// Fetcher
export { fetchUrl, FetchError, assertSafeUrl } from "./fetcher.js";
export type { FetchResult } from "./fetcher.js";

// Context
export { buildCheckContext } from "./context.js";

// llms.txt parser (shared with @beacon/ai generator, see #233)
export { parseLlmsTxt } from "./checks/llms-txt-parser.js";
export type { ParsedLlmsTxt } from "./checks/llms-txt-parser.js";

// Schema.org constants (shared with @beacon/ai generator, see #240)
export { REQUIRED_PROPERTIES as SCHEMA_ORG_REQUIRED_PROPERTIES } from "./checks/schema-org.js";

// agents-md parser (shared with @beacon/ai generator, see #247)
export { parseAgentsMd } from "./checks/agents-md-parser.js";
export type { ParsedAgentsMd } from "./checks/agents-md-parser.js";

// Milestone detection (#274)
export {
	detectMilestones,
	DEFAULT_MILESTONE_CONFIG,
} from "./services/milestone-detector.js";
export type {
	MilestoneDetectionContext,
	DetectedMilestone,
	ExistingMilestone,
	MilestoneRuleConfig,
} from "./services/milestone-detector.js";

// Citation page matcher (#175)
export { matchCitationToClientPage, levenshtein } from "./services/citation-matcher.js";
export type {
	MatchKind,
	MatchCandidate,
	MatchResult,
	MatcherInput,
} from "./services/citation-matcher.js";

// Citation before/after impact (#179)
export { computeCitationDelta } from "./services/citation-snapshot.js";
export type {
	CitationSnapshotData,
	CitationDelta,
} from "./services/citation-snapshot.js";

// Citation URL utils (#228)
export {
	extractCitationUrls,
	normalizeUrl,
	resolveRelative,
} from "./services/citation-url-utils.js";
export type { NormalizeUrlOptions } from "./services/citation-url-utils.js";

// Reddit-to-AI-Citation linker (#186)
export {
	parseRedditUrl,
	isRedditUrl,
	extractRedditUrls,
	matchCitationsToMentions,
} from "./reddit-citation-linker.js";
export type {
	ParsedRedditUrl,
	CitationLinkCandidate,
	CitationInput,
} from "./reddit-citation-linker.js";

// Side-effect imports: register checks in defaultRegistry
import "./checks/llms-txt.js";
import "./checks/robots-txt.js";
import "./checks/sitemap-xml.js";
import "./checks/agents-md.js";
import "./checks/schema-org.js";
import "./checks/meta-tags.js";
import "./checks/content-structure.js";
import "./checks/webmcp.js";
import "./checks/performance.js";
import "./checks/semantic-quality.js";
import "./checks/citation-readiness.js";
import "./checks/content-freshness.js";
import "./checks/faq-schema.js";
import "./checks/js-rendering.js";
