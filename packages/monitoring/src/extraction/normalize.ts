import type { MatchResult } from "./types.js";

/**
 * Deduplicates overlapping matches within a given character radius.
 * Keeps the match with the highest confidence. On tie, prefers exact > fuzzy > contextual.
 */
export function deduplicateMatches(matches: MatchResult[], radiusChars: number): MatchResult[] {
	if (matches.length <= 1) return matches;

	const PRIORITY: Record<string, number> = { exact: 3, fuzzy: 2, contextual: 1 };

	const sorted = [...matches].sort((a, b) => a.charOffset - b.charOffset);
	const result: MatchResult[] = [];

	for (const match of sorted) {
		const last = result[result.length - 1];
		if (
			last &&
			last.brandCanonicalName === match.brandCanonicalName &&
			Math.abs(match.charOffset - last.charOffset) < radiusChars
		) {
			// Overlapping — keep higher confidence, then higher priority match type
			const lastScore = last.confidence * 10 + (PRIORITY[last.matchType] ?? 0);
			const currScore = match.confidence * 10 + (PRIORITY[match.matchType] ?? 0);
			if (currScore > lastScore) {
				result[result.length - 1] = match;
			}
		} else {
			result.push(match);
		}
	}

	return result;
}

/**
 * Extracts a context window around a match position.
 */
export function extractContextWindow(
	text: string,
	charOffset: number,
	matchLength: number,
	windowChars: number,
): string {
	const start = Math.max(0, charOffset - windowChars);
	const end = Math.min(text.length, charOffset + matchLength + windowChars);
	return text.slice(start, end).trim();
}

/**
 * Computes relative position in text: top (first third), middle, bottom (last third).
 */
export function computeRelativePosition(
	charOffset: number,
	textLength: number,
): "top" | "middle" | "bottom" {
	if (textLength === 0) return "top";
	const ratio = charOffset / textLength;
	if (ratio < 0.33) return "top";
	if (ratio < 0.66) return "middle";
	return "bottom";
}
