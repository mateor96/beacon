import type { BrandConfig } from "./types.js";

/**
 * Builds a BrandConfig from monitoring project data.
 * First keyword becomes canonical name; all keywords are used for matching.
 * Domain is extracted from the project's website URL.
 */
export function buildBrandConfig(
	brandName: string,
	brandKeywords: string[],
	websiteUrl: string,
): BrandConfig {
	let domain = "";
	try {
		domain = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
	} catch {
		// Invalid URL — skip domain matching
	}

	return {
		canonicalName: brandName,
		primaryNames: brandKeywords.length > 0 ? [...new Set(brandKeywords)] : [brandName],
		domains: domain ? [domain] : [],
	};
}
