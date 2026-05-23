export { extractMentions } from "./extract-mentions.js";
export { buildBrandConfig } from "./build-brand-config.js";
export { deduplicateMatches, extractContextWindow, computeRelativePosition } from "./normalize.js";
export { classifyMentionType, classifySentiment } from "./classify.js";
export { exactMatchStrategy } from "./exact-match.strategy.js";
export {
	fuzzyMatchStrategy,
	jaroWinklerSimilarity,
	levenshteinDistance,
} from "./fuzzy-match.strategy.js";
export { contextualMatchStrategy } from "./contextual-match.strategy.js";
export { tokenize } from "./tokenize.js";
export {
	DEFAULT_EXTRACTION_OPTIONS,
	MATCH_TYPES,
	MENTION_TYPES,
	SENTIMENTS,
} from "./types.js";
export type {
	BrandConfig,
	ExtractionOptions,
	ExtractionReport,
	MatchResult,
	MatchStrategy,
	MatchType,
	MentionResult,
	MentionType,
	Sentiment,
	Token,
} from "./types.js";
