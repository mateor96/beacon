const TRACKING_PARAM_PATTERNS = [
	/^utm_/i,
	/^fbclid$/i,
	/^gclid$/i,
	/^gclsrc$/i,
	/^dclid$/i,
	/^msclkid$/i,
	/^mc_cid$/i,
	/^mc_eid$/i,
	/^_ga$/i,
	/^_gl$/i,
	/^yclid$/i,
	/^ref$/i,
	/^ref_src$/i,
	/^ref_url$/i,
	/^igshid$/i,
	/^hsCtaTracking$/i,
];

function isTrackingParam(name: string): boolean {
	return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(name));
}

export interface NormalizedUrl {
	url: string;
	domain: string;
}

/**
 * Normalize a raw URL: lowercase host, strip tracking params and fragment,
 * remove trailing slash on empty path, preserve query order for remaining params.
 * Returns null for anything that cannot be parsed as an http(s) URL.
 */
export function normalizeUrl(raw: string): NormalizedUrl | null {
	let parsed: URL;
	try {
		parsed = new URL(raw.trim());
	} catch {
		return null;
	}

	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return null;
	}

	parsed.hostname = parsed.hostname.toLowerCase();
	parsed.hash = "";

	const keptParams: Array<[string, string]> = [];
	for (const [key, value] of parsed.searchParams) {
		if (!isTrackingParam(key)) {
			keptParams.push([key, value]);
		}
	}
	parsed.search = "";
	for (const [key, value] of keptParams) {
		parsed.searchParams.append(key, value);
	}

	let normalized = parsed.toString();
	if (parsed.pathname === "/" && !parsed.search) {
		normalized = normalized.replace(/\/$/, "");
	}

	return {
		url: normalized,
		domain: parsed.hostname,
	};
}
