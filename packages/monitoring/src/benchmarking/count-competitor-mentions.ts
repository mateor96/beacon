import { findUrlSpans } from "../extraction/tokenize.js";

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Counts how many times each competitor keyword appears in text.
 * Uses word-boundary regex matching (same pattern as exact match strategy).
 * Skips matches inside URLs.
 */
export function countCompetitorMentions(
	text: string,
	competitorKeywords: string[],
): Map<string, number> {
	const counts = new Map<string, number>();
	if (!text || competitorKeywords.length === 0) return counts;

	const urlSpans = findUrlSpans(text);

	for (const keyword of competitorKeywords) {
		if (keyword.length === 0) continue;

		const escaped = escapeRegex(keyword);
		const caseInsensitive = keyword.length > 2;
		const flags = caseInsensitive ? "gi" : "g";
		const regex = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, flags);

		let count = 0;
		let match: RegExpExecArray | null = regex.exec(text);
		while (match !== null) {
			// Skip matches inside URLs
			const matchIndex = match.index;
			const inUrl = urlSpans.some((s) => matchIndex >= s.start && matchIndex < s.end);
			if (!inUrl) count++;
			match = regex.exec(text);
		}

		if (count > 0) {
			counts.set(keyword, (counts.get(keyword) ?? 0) + count);
		}
	}

	return counts;
}
