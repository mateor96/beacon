import type { MentionType, Sentiment } from "./types.js";

// ── Mention Type Classification ─────────────────────────────

const RECOMMENDATION_PATTERNS = [
	"recommend",
	"empfehl",
	"should use",
	"best choice",
	"top pick",
	"go with",
	"suggest",
	"vorschlag",
	"ideal for",
	"am besten",
	"highly rated",
	"erste wahl",
];

const COMPARISON_PATTERNS = [
	"compared to",
	" vs ",
	" vs.",
	"versus",
	"im vergleich",
	"better than",
	"worse than",
	"alternative to",
	"unlike",
	"im gegensatz",
	"instead of",
	"anstatt",
	"gegenüber",
];

const CITATION_PATTERNS = [
	"according to",
	"laut",
	"source:",
	"reports that",
	"states that",
	"published by",
	"data from",
	"research by",
	"studie von",
	"berichtet",
];

/**
 * Classifies a mention type based on surrounding context text.
 * Checks in priority order: recommendation > comparison > citation > passing.
 */
export function classifyMentionType(contextText: string): MentionType {
	const lower = contextText.toLowerCase();

	if (RECOMMENDATION_PATTERNS.some((kw) => lower.includes(kw))) return "recommendation";
	if (COMPARISON_PATTERNS.some((kw) => lower.includes(kw))) return "comparison";
	if (CITATION_PATTERNS.some((kw) => lower.includes(kw))) return "citation";
	return "passing";
}

// ── Sentiment Classification ────────────────────────────────

const POSITIVE_KEYWORDS = [
	"excellent",
	"great",
	"best",
	"outstanding",
	"superior",
	"reliable",
	"innovative",
	"empfehlenswert",
	"hervorragend",
	"zuverlässig",
	"top",
	"leading",
	"strong",
	"powerful",
	"impressive",
	"trusted",
	"preferred",
];

const NEGATIVE_KEYWORDS = [
	"poor",
	"bad",
	"worst",
	"unreliable",
	"lacking",
	"disappointing",
	"schlecht",
	"mangelhaft",
	"schwach",
	"problematic",
	"fails",
	"inferior",
	"limited",
	"overpriced",
	"avoid",
	"vermeiden",
];

/**
 * Classifies sentiment of a mention based on surrounding context.
 * Uses keyword-based weighted scoring.
 */
export function classifySentiment(contextText: string): Sentiment {
	const lower = contextText.toLowerCase();
	let score = 0;

	for (const kw of POSITIVE_KEYWORDS) {
		if (lower.includes(kw)) score++;
	}
	for (const kw of NEGATIVE_KEYWORDS) {
		if (lower.includes(kw)) score--;
	}

	if (score > 0) return "positive";
	if (score < 0) return "negative";
	return "neutral";
}
