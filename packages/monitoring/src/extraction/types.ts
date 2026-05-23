// ── Match & Mention Type Constants ──────────────────────────

export const MATCH_TYPES = ["exact", "fuzzy", "contextual"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MENTION_TYPES = ["recommendation", "comparison", "citation", "passing"] as const;
export type MentionType = (typeof MENTION_TYPES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const RELATIVE_POSITIONS = ["top", "middle", "bottom"] as const;
export type RelativePosition = (typeof RELATIVE_POSITIONS)[number];

// ── Brand Configuration ─────────────────────────────────────

export interface BrandConfig {
	/** Canonical brand name (used for normalization and DB storage). */
	canonicalName: string;
	/** All name variants for exact matching (includes canonical). */
	primaryNames: string[];
	/** Known domains for contextual URL matching. */
	domains: string[];
}

// ── Tokenization ────────────────────────────────────────────

export interface Token {
	text: string;
	offset: number;
	length: number;
	isUrl: boolean;
}

// ── Intermediate Match Result ───────────────────────────────

export interface MatchResult {
	matchedText: string;
	matchType: MatchType;
	charOffset: number;
	endOffset: number;
	confidence: number;
	brandCanonicalName: string;
}

// ── Strategy Interface ──────────────────────────────────────

export interface MatchStrategy {
	readonly type: MatchType;
	findMatches(text: string, brand: BrandConfig, options: ExtractionOptions): MatchResult[];
}

// ── Final Mention Result ────────────────────────────────────

export interface MentionResult {
	/** Canonical brand name. */
	brandName: string;
	/** Classified mention type. */
	mentionType: MentionType;
	/** Character offset in response text (stored in aiMentions.position). */
	position: number;
	/** Surrounding context text (±contextWindowChars). */
	contextText: string;
	/** Detected sentiment. */
	sentiment: Sentiment;
	/** How the mention was found (not persisted to DB). */
	matchType: MatchType;
	/** Confidence score 0-1 (not persisted to DB). */
	confidence: number;
}

// ── Extraction Options ──────────────────────────────────────

export interface ExtractionOptions {
	/** Minimum Jaro-Winkler similarity for fuzzy matching. Default: 0.85. */
	fuzzyMinSimilarity: number;
	/** Maximum mentions to return per response. Default: 50. */
	maxMentionsPerResponse: number;
	/** Characters of context to capture on each side. Default: 150. */
	contextWindowChars: number;
	/** Dedup radius in characters. Default: 20. */
	deduplicateRadius: number;
	/** Minimum confidence to include a match. Default: 0.7. */
	minConfidence: number;
}

export const DEFAULT_EXTRACTION_OPTIONS: ExtractionOptions = {
	fuzzyMinSimilarity: 0.85,
	maxMentionsPerResponse: 50,
	contextWindowChars: 150,
	deduplicateRadius: 20,
	minConfidence: 0.7,
};

// ── Extraction Report ───────────────────────────────────────

export interface ExtractionReport {
	mentions: MentionResult[];
	totalRawMatches: number;
	deduplicatedCount: number;
	durationMs: number;
}
