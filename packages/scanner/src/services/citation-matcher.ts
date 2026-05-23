export type MatchKind = "exact" | "path" | "fuzzy" | "manual" | "unmatched";

export interface MatchCandidate {
	clientPageId: string;
	url: string;
}

export interface MatchResult {
	clientPageId: string | null;
	matchType: MatchKind;
	/** Confidence as integer basis points (0–100). 100 = exact, 80 = path, 50–70 = fuzzy, 100 = manual. */
	confidence: number;
}

interface ParsedUrl {
	host: string;
	path: string;
}

function parse(url: string): ParsedUrl | null {
	try {
		const u = new URL(url);
		if (u.protocol !== "http:" && u.protocol !== "https:") return null;
		return {
			host: u.hostname.toLowerCase().replace(/^www\./, ""),
			path: u.pathname.replace(/\/$/, "") || "/",
		};
	} catch {
		return null;
	}
}

/**
 * Levenshtein distance. Small iterative implementation that allocates one row
 * of length |b|+1. Capped at `maxDistance`: returns `maxDistance + 1` early
 * once the running minimum exceeds the cap (saves work for long, very
 * different strings).
 */
export function levenshtein(a: string, b: string, maxDistance = 3): number {
	if (a === b) return 0;
	if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	let prev = new Array<number>(b.length + 1);
	let curr = new Array<number>(b.length + 1);
	for (let j = 0; j <= b.length; j++) prev[j] = j;

	for (let i = 1; i <= a.length; i++) {
		curr[0] = i;
		let rowMin = curr[0];
		for (let j = 1; j <= b.length; j++) {
			const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
			curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
			if (curr[j] < rowMin) rowMin = curr[j];
		}
		if (rowMin > maxDistance) return maxDistance + 1;
		[prev, curr] = [curr, prev];
	}
	return prev[b.length];
}

export interface MatcherInput {
	citationUrl: string;
	candidates: MatchCandidate[];
	/** Known manual aliases keyed by raw citation URL → client_page_id. */
	manualAliases?: Map<string, string>;
	/** Maximum Levenshtein distance allowed for fuzzy matches. Defaults to 2. */
	fuzzyMaxDistance?: number;
}

/**
 * Match a citation URL against a list of client-page URLs using a three-step
 * cascade: manual alias lookup → exact → domain+path → fuzzy (Levenshtein on
 * path only, same host required). Returns the highest-confidence match.
 *
 * Confidence scale (integer basis points):
 * - 100: exact URL match or manual alias hit
 * -  80: same host + same path
 * -  50–70: fuzzy path match within fuzzyMaxDistance, scaled down by distance
 * -   0: unmatched
 */
export function matchCitationToClientPage(input: MatcherInput): MatchResult {
	const { citationUrl, candidates, manualAliases, fuzzyMaxDistance = 2 } = input;

	if (manualAliases?.has(citationUrl)) {
		const clientPageId = manualAliases.get(citationUrl);
		if (clientPageId) {
			return { clientPageId, matchType: "manual", confidence: 100 };
		}
	}

	const citationParsed = parse(citationUrl);
	if (!citationParsed) {
		return { clientPageId: null, matchType: "unmatched", confidence: 0 };
	}

	let pathMatch: MatchResult | null = null;
	let bestFuzzy: { clientPageId: string; distance: number } | null = null;

	for (const candidate of candidates) {
		if (candidate.url === citationUrl) {
			return { clientPageId: candidate.clientPageId, matchType: "exact", confidence: 100 };
		}
		const candidateParsed = parse(candidate.url);
		if (!candidateParsed) continue;
		if (candidateParsed.host !== citationParsed.host) continue;

		if (candidateParsed.path === citationParsed.path) {
			if (!pathMatch) {
				pathMatch = { clientPageId: candidate.clientPageId, matchType: "path", confidence: 80 };
			}
			continue;
		}

		const distance = levenshtein(candidateParsed.path, citationParsed.path, fuzzyMaxDistance);
		if (distance <= fuzzyMaxDistance) {
			if (!bestFuzzy || distance < bestFuzzy.distance) {
				bestFuzzy = { clientPageId: candidate.clientPageId, distance };
			}
		}
	}

	if (pathMatch) return pathMatch;

	if (bestFuzzy) {
		const confidence = 70 - bestFuzzy.distance * 10;
		return {
			clientPageId: bestFuzzy.clientPageId,
			matchType: "fuzzy",
			confidence,
		};
	}

	return { clientPageId: null, matchType: "unmatched", confidence: 0 };
}
