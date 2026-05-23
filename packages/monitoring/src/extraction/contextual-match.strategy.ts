import type { BrandConfig, ExtractionOptions, MatchResult, MatchStrategy } from "./types.js";

const URL_REGEX = /https?:\/\/[^\s)\]>"']+/g;

function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		// Try to extract domain from bare URL
		const match = url.match(/^https?:\/\/(?:www\.)?([^/\s]+)/);
		return match ? match[1].toLowerCase() : "";
	}
}

export const contextualMatchStrategy: MatchStrategy = {
	type: "contextual",

	findMatches(text: string, brand: BrandConfig, _options: ExtractionOptions): MatchResult[] {
		if (brand.domains.length === 0) return [];

		const results: MatchResult[] = [];
		const brandDomains = new Set(brand.domains.map((d) => d.toLowerCase().replace(/^www\./, "")));

		// Scan for URLs and match domains against brand domains
		const regex = new RegExp(URL_REGEX.source, "g");
		let match: RegExpExecArray | null = regex.exec(text);
		while (match !== null) {
			const url = match[0];
			const domain = extractDomain(url);
			if (domain && brandDomains.has(domain)) {
				results.push({
					matchedText: url,
					matchType: "contextual",
					charOffset: match.index,
					endOffset: match.index + url.length,
					confidence: 0.85,
					brandCanonicalName: brand.canonicalName,
				});
			}
			match = regex.exec(text);
		}

		return results;
	},
};
