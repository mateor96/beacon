import { findUrlSpans } from "./tokenize.js";
import type { BrandConfig, ExtractionOptions, MatchResult, MatchStrategy } from "./types.js";

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildExactRegex(name: string, caseInsensitive: boolean): RegExp {
	const escaped = escapeRegex(name);
	const flags = caseInsensitive ? "gi" : "g";
	// Use negative lookaround for word boundaries (safer than \b for non-ASCII)
	return new RegExp(`(?<![\\w])${escaped}(?![\\w])`, flags);
}

export const exactMatchStrategy: MatchStrategy = {
	type: "exact",

	findMatches(text: string, brand: BrandConfig, _options: ExtractionOptions): MatchResult[] {
		const results: MatchResult[] = [];
		const urlSpans = findUrlSpans(text);

		for (const name of brand.primaryNames) {
			if (name.length === 0) continue;

			// Short brand names (<=2 chars): require exact case to reduce false positives
			const caseInsensitive = name.length > 2;
			const regex = buildExactRegex(name, caseInsensitive);

			let match: RegExpExecArray | null = regex.exec(text);
			while (match !== null) {
				const charOffset = match.index;

				// Skip matches inside URLs
				if (!urlSpans.some((s) => charOffset >= s.start && charOffset < s.end)) {
					results.push({
						matchedText: match[0],
						matchType: "exact",
						charOffset,
						endOffset: charOffset + match[0].length,
						confidence: 1.0,
						brandCanonicalName: brand.canonicalName,
					});
				}

				match = regex.exec(text);
			}
		}

		return results;
	},
};
