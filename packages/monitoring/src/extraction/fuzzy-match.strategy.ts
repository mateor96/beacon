import { tokenize } from "./tokenize.js";
import type { BrandConfig, ExtractionOptions, MatchResult, MatchStrategy } from "./types.js";

// ── Jaro-Winkler Similarity ────────────────────────────────

export function jaroSimilarity(s1: string, s2: string): number {
	if (s1 === s2) return 1.0;
	if (s1.length === 0 || s2.length === 0) return 0.0;

	const matchWindow = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);

	const s1Matches = new Array<boolean>(s1.length).fill(false);
	const s2Matches = new Array<boolean>(s2.length).fill(false);

	let matches = 0;
	let transpositions = 0;

	for (let i = 0; i < s1.length; i++) {
		const lo = Math.max(0, i - matchWindow);
		const hi = Math.min(i + matchWindow + 1, s2.length);
		for (let j = lo; j < hi; j++) {
			if (s2Matches[j] || s1[i] !== s2[j]) continue;
			s1Matches[i] = true;
			s2Matches[j] = true;
			matches++;
			break;
		}
	}

	if (matches === 0) return 0.0;

	let k = 0;
	for (let i = 0; i < s1.length; i++) {
		if (!s1Matches[i]) continue;
		while (!s2Matches[k]) k++;
		if (s1[i] !== s2[k]) transpositions++;
		k++;
	}

	return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

export function jaroWinklerSimilarity(s1: string, s2: string): number {
	const jaro = jaroSimilarity(s1, s2);
	let commonPrefix = 0;
	const limit = Math.min(4, Math.min(s1.length, s2.length));
	for (let i = 0; i < limit; i++) {
		if (s1[i] === s2[i]) commonPrefix++;
		else break;
	}
	return jaro + commonPrefix * 0.1 * (1 - jaro);
}

// ── Levenshtein Distance ───────────────────────────────────

export function levenshteinDistance(s1: string, s2: string): number {
	if (s1 === s2) return 0;
	if (s1.length === 0) return s2.length;
	if (s2.length === 0) return s1.length;

	// Early exit if length difference exceeds max possible useful threshold
	if (Math.abs(s1.length - s2.length) > 3) return Math.abs(s1.length - s2.length);

	let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
	let curr = new Array<number>(s2.length + 1);

	for (let i = 1; i <= s1.length; i++) {
		curr[0] = i;
		for (let j = 1; j <= s2.length; j++) {
			const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		[prev, curr] = [curr, prev];
	}

	return prev[s2.length];
}

// ── Fuzzy Match Strategy ───────────────────────────────────

function getThresholds(
	brandNameLength: number,
	configuredMinSimilarity: number,
): { useJW: boolean; jwThreshold: number; maxLevenshtein: number } | null {
	if (brandNameLength <= 2) return null; // skip fuzzy for very short names
	if (brandNameLength <= 4) return { useJW: false, jwThreshold: 0, maxLevenshtein: 1 };
	if (brandNameLength <= 7)
		return { useJW: true, jwThreshold: Math.max(0.88, configuredMinSimilarity), maxLevenshtein: 2 };
	return { useJW: true, jwThreshold: configuredMinSimilarity, maxLevenshtein: 3 };
}

export const fuzzyMatchStrategy: MatchStrategy = {
	type: "fuzzy",

	findMatches(text: string, brand: BrandConfig, options: ExtractionOptions): MatchResult[] {
		const results: MatchResult[] = [];
		const tokens = tokenize(text);
		const nonUrlTokens = tokens.filter((t) => !t.isUrl);

		for (const name of brand.primaryNames) {
			const lowerName = name.toLowerCase();
			const thresholds = getThresholds(lowerName.length, options.fuzzyMinSimilarity);
			if (!thresholds) continue;

			// Single-word matching
			for (const token of nonUrlTokens) {
				// Length pre-filter: skip tokens whose length differs by more than 2
				if (Math.abs(token.text.length - lowerName.length) > 2) continue;

				const lowerToken = token.text.toLowerCase();
				// Skip exact matches (those are handled by the exact strategy)
				if (lowerToken === lowerName) continue;

				let confidence = 0;
				let passes = false;

				if (thresholds.useJW) {
					const jw = jaroWinklerSimilarity(lowerToken, lowerName);
					const lev = levenshteinDistance(lowerToken, lowerName);
					if (jw >= thresholds.jwThreshold && lev <= thresholds.maxLevenshtein) {
						confidence = jw * 0.9; // cap fuzzy confidence at 0.9
						passes = true;
					}
				} else {
					const lev = levenshteinDistance(lowerToken, lowerName);
					if (lev <= thresholds.maxLevenshtein) {
						confidence = (1 - lev / Math.max(lowerToken.length, lowerName.length)) * 0.9;
						passes = true;
					}
				}

				if (passes) {
					results.push({
						matchedText: token.text,
						matchType: "fuzzy",
						charOffset: token.offset,
						endOffset: token.offset + token.length,
						confidence,
						brandCanonicalName: brand.canonicalName,
					});
				}
			}

			// Multi-word brand name matching via n-grams
			const nameWords = name.split(/\s+/);
			if (nameWords.length > 1) {
				for (let i = 0; i <= nonUrlTokens.length - nameWords.length; i++) {
					const gram = nonUrlTokens.slice(i, i + nameWords.length);
					const gramText = gram.map((t) => t.text).join(" ");
					const lowerGram = gramText.toLowerCase();

					if (lowerGram === lowerName) continue; // exact match, skip

					if (thresholds.useJW) {
						const jw = jaroWinklerSimilarity(lowerGram, lowerName);
						const lev = levenshteinDistance(lowerGram, lowerName);
						if (jw >= thresholds.jwThreshold && lev <= thresholds.maxLevenshtein) {
							results.push({
								matchedText: gramText,
								matchType: "fuzzy",
								charOffset: gram[0].offset,
								endOffset: gram[gram.length - 1].offset + gram[gram.length - 1].length,
								confidence: jw * 0.9,
								brandCanonicalName: brand.canonicalName,
							});
						}
					}
				}
			}
		}

		return results;
	},
};
