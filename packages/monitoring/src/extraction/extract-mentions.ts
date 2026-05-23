import { classifyMentionType, classifySentiment } from "./classify.js";
import { contextualMatchStrategy } from "./contextual-match.strategy.js";
import { exactMatchStrategy } from "./exact-match.strategy.js";
import { fuzzyMatchStrategy } from "./fuzzy-match.strategy.js";
import { deduplicateMatches, extractContextWindow } from "./normalize.js";
import type {
	BrandConfig,
	ExtractionOptions,
	ExtractionReport,
	MatchResult,
	MentionResult,
} from "./types.js";
import { DEFAULT_EXTRACTION_OPTIONS } from "./types.js";

/**
 * Extracts brand mentions from AI response text.
 *
 * Runs three strategies (exact → fuzzy → contextual), deduplicates,
 * classifies mention type and sentiment, and returns structured results.
 *
 * Pure function — no I/O, no side effects.
 */
export function extractMentions(
	text: string,
	brandConfig: BrandConfig,
	options?: Partial<ExtractionOptions>,
): ExtractionReport {
	const startTime = performance.now();
	const opts: ExtractionOptions = { ...DEFAULT_EXTRACTION_OPTIONS, ...options };

	// Guard: empty input
	if (!text || text.trim().length === 0 || brandConfig.primaryNames.length === 0) {
		return {
			mentions: [],
			totalRawMatches: 0,
			deduplicatedCount: 0,
			durationMs: performance.now() - startTime,
		};
	}

	// 1. Run all strategies
	const allMatches: MatchResult[] = [
		...exactMatchStrategy.findMatches(text, brandConfig, opts),
		...fuzzyMatchStrategy.findMatches(text, brandConfig, opts),
		...contextualMatchStrategy.findMatches(text, brandConfig, opts),
	];

	const totalRawMatches = allMatches.length;

	// 2. Filter by minimum confidence
	const confident = allMatches.filter((m) => m.confidence >= opts.minConfidence);

	// 3. Deduplicate overlapping matches
	const deduped = deduplicateMatches(confident, opts.deduplicateRadius);
	const deduplicatedCount = confident.length - deduped.length;

	// 4. Sort by position and build final MentionResult[]
	const sorted = deduped.sort((a, b) => a.charOffset - b.charOffset);

	const mentions: MentionResult[] = sorted.slice(0, opts.maxMentionsPerResponse).map((match) => {
		const contextText = extractContextWindow(
			text,
			match.charOffset,
			match.matchedText.length,
			opts.contextWindowChars,
		);

		return {
			brandName: match.brandCanonicalName,
			mentionType: classifyMentionType(contextText),
			position: match.charOffset,
			contextText,
			sentiment: classifySentiment(contextText),
			matchType: match.matchType,
			confidence: match.confidence,
		};
	});

	return {
		mentions,
		totalRawMatches,
		deduplicatedCount,
		durationMs: performance.now() - startTime,
	};
}
