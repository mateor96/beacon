/**
 * URL extraction + normalization utilities for citation processing (#228).
 *
 * Separated from citation-matcher so callers that only need one or the
 * other don't pay for both. All helpers are pure — no I/O, no DB.
 */

const URL_RE = /\bhttps?:\/\/[^\s<>()"']+/gi;

const UTM_PARAM_RE = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|ref_|_hsenc|_hsmi|msclkid)/i;

/** Strips trailing punctuation that commonly clings to URLs in prose. */
function stripTrailingPunctuation(url: string): string {
	return url.replace(/[.,;:!?\)\]\}'"`]+$/, "");
}

/**
 * Extract all `http(s)://` URLs from a block of AI response text.
 *
 * Handles:
 *  - inline URLs
 *  - markdown links `[text](url)`
 *  - numbered references `[1] url`
 *  - trailing punctuation in prose
 *
 * Returns a deduplicated, order-preserving list.
 */
export function extractCitationUrls(text: string): string[] {
	if (!text) return [];

	// First pull markdown link URLs (more reliable than a generic match).
	const out: string[] = [];
	const seen = new Set<string>();

	const markdownRe = /\]\((https?:\/\/[^\s)]+)\)/g;
	for (const m of text.matchAll(markdownRe)) {
		const url = m[1];
		if (url && !seen.has(url)) {
			seen.add(url);
			out.push(url);
		}
	}

	// Then scan for inline / numbered URLs.
	for (const m of text.matchAll(URL_RE)) {
		const cleaned = stripTrailingPunctuation(m[0]);
		if (!seen.has(cleaned)) {
			seen.add(cleaned);
			out.push(cleaned);
		}
	}

	return out;
}

export interface NormalizeUrlOptions {
	/** Strip `#fragment` — default true. */
	stripFragment?: boolean;
	/** Strip analytics query params (utm_*, fbclid, gclid, mc_*, ref). Default true. */
	stripTrackingParams?: boolean;
	/** Strip the full query string — default false. */
	stripQuery?: boolean;
	/** Lowercase the hostname — default true. */
	lowercaseHost?: boolean;
	/** Strip leading `www.` — default true. */
	stripWww?: boolean;
	/** Strip trailing slash from path (preserving root `/`). Default true. */
	stripTrailingSlash?: boolean;
}

/**
 * Canonicalise a URL for matching. Returns the input untouched if it
 * fails to parse as a URL so broken citations can still round-trip
 * through the matcher (which will report them as unmatched).
 */
export function normalizeUrl(url: string, opts: NormalizeUrlOptions = {}): string {
	const {
		stripFragment = true,
		stripTrackingParams = true,
		stripQuery = false,
		lowercaseHost = true,
		stripWww = true,
		stripTrailingSlash = true,
	} = opts;

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}

	if (stripFragment) parsed.hash = "";

	if (stripQuery) {
		parsed.search = "";
	} else if (stripTrackingParams) {
		const toDelete: string[] = [];
		parsed.searchParams.forEach((_, key) => {
			if (UTM_PARAM_RE.test(key)) toDelete.push(key);
		});
		for (const key of toDelete) parsed.searchParams.delete(key);
	}

	if (lowercaseHost) {
		parsed.hostname = parsed.hostname.toLowerCase();
	}
	if (stripWww && parsed.hostname.startsWith("www.")) {
		parsed.hostname = parsed.hostname.slice(4);
	}

	if (stripTrailingSlash && parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
		parsed.pathname = parsed.pathname.slice(0, -1);
	}

	return parsed.toString();
}

/**
 * Resolve a possibly-relative URL against a base. Returns the input
 * unchanged if both fail to parse.
 */
export function resolveRelative(url: string, base: string): string {
	try {
		return new URL(url, base).toString();
	} catch {
		return url;
	}
}
