import { classifySentiment } from "../extraction/classify.js";
import { countCompetitorMentions } from "./count-competitor-mentions.js";
import type { BenchmarkInput, BenchmarkReport, CompetitorMetrics } from "./types.js";

function sentimentToNumeric(sentiment: "positive" | "neutral" | "negative"): number {
	const map = { positive: 1, neutral: 0, negative: -1 };
	return map[sentiment];
}

function extractContextAround(text: string, keyword: string, windowChars = 150): string {
	const lower = text.toLowerCase();
	const idx = lower.indexOf(keyword.toLowerCase());
	if (idx === -1) return "";
	const start = Math.max(0, idx - windowChars);
	const end = Math.min(text.length, idx + keyword.length + windowChars);
	return text.slice(start, end);
}

/**
 * Computes competitor benchmarks for a single snapshot.
 *
 * For each competitor:
 * - Share of Voice: competitor mentions / total mentions
 * - Average Sentiment: keyword-based sentiment from context window
 * - Average Rank: from ranking data (0 if not ranked)
 *
 * Pure function — no I/O.
 */
export function computeBenchmarks(
	input: BenchmarkInput,
	competitorRanks: Map<string, number>,
): BenchmarkReport {
	const startTime = performance.now();

	if (input.competitorKeywords.length === 0) {
		return {
			competitors: [],
			totalMentions: input.brandMentionCount,
			durationMs: performance.now() - startTime,
		};
	}

	// Count competitor mentions
	const mentionCounts = countCompetitorMentions(input.responseText, input.competitorKeywords);

	// Total mentions = brand + all competitors
	let competitorMentionTotal = 0;
	for (const count of mentionCounts.values()) {
		competitorMentionTotal += count;
	}
	const totalMentions = input.brandMentionCount + competitorMentionTotal;

	// Compute metrics per competitor
	const competitors: CompetitorMetrics[] = [];

	for (const keyword of input.competitorKeywords) {
		const mentionCount = mentionCounts.get(keyword) ?? 0;

		// Share of Voice
		const shareOfVoice = totalMentions > 0 ? mentionCount / totalMentions : 0;

		// Sentiment: classify context around first mention
		let avgSentiment = 0;
		if (mentionCount > 0) {
			const context = extractContextAround(input.responseText, keyword);
			if (context.length > 0) {
				const sentiment = classifySentiment(context);
				avgSentiment = sentimentToNumeric(sentiment);
			}
		}

		// Rank: from ranking extraction data
		const avgRank = competitorRanks.get(keyword) ?? 0;

		competitors.push({
			name: keyword,
			mentionCount,
			shareOfVoice,
			avgSentiment,
			avgRank,
		});
	}

	return {
		competitors,
		totalMentions,
		durationMs: performance.now() - startTime,
	};
}
