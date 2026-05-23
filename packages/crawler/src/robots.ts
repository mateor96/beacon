/**
 * Minimal robots.txt parser scoped to the User-Agent we ship as
 * (`BeaconBot/1.0`). Honours `Disallow:` and `Sitemap:` directives;
 * everything else (Crawl-delay, Allow with longer match, comments)
 * is ignored. The crawler obeys host-level robots — no per-page
 * meta-robots support.
 */

export interface RobotsRules {
	disallowedPaths: string[];
	sitemaps: string[];
}

const USER_AGENT = "BeaconBot";

function* sections(text: string): IterableIterator<{ uaTokens: string[]; lines: string[] }> {
	const lines = text.split(/\r?\n/);
	let uaTokens: string[] = [];
	let buffer: string[] = [];
	let inUaBlock = false;

	for (const raw of lines) {
		const line = raw.split("#")[0].trim();
		if (!line) continue;
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim().toLowerCase();
		const value = line.slice(colonIdx + 1).trim();

		if (key === "user-agent") {
			if (inUaBlock && buffer.length > 0) {
				yield { uaTokens, lines: buffer };
				buffer = [];
			}
			if (!inUaBlock) {
				uaTokens = [];
			}
			uaTokens.push(value);
			inUaBlock = true;
		} else if (inUaBlock) {
			buffer.push(`${key}:${value}`);
		} else if (key === "sitemap") {
			// Top-level sitemap, no UA scope. We surface it by yielding a
			// pseudo-section so the caller can collect.
			yield { uaTokens: ["__global__"], lines: [`sitemap:${value}`] };
		}
	}
	if (uaTokens.length > 0 && buffer.length > 0) {
		yield { uaTokens, lines: buffer };
	}
}

export function parseRobots(text: string): RobotsRules {
	const disallowed = new Set<string>();
	const sitemaps = new Set<string>();
	let matched = false;

	for (const section of sections(text)) {
		const targetsUs = section.uaTokens.some(
			(t) =>
				t === "*" ||
				t.toLowerCase() === USER_AGENT.toLowerCase() ||
				t.toLowerCase().startsWith(USER_AGENT.toLowerCase()),
		);
		const isGlobal = section.uaTokens.includes("__global__");

		if (targetsUs) matched = true;

		for (const line of section.lines) {
			const [key, ...rest] = line.split(":");
			const value = rest.join(":").trim();
			if (!value) continue;
			if (key === "sitemap" && isGlobal) {
				sitemaps.add(value);
			} else if (targetsUs && key === "disallow") {
				disallowed.add(value);
			}
		}
	}

	// If no UA-scoped rules matched, fall back to allow-all.
	void matched;

	return {
		disallowedPaths: [...disallowed],
		sitemaps: [...sitemaps],
	};
}

export function isPathAllowed(rules: RobotsRules, pathname: string): boolean {
	for (const disallow of rules.disallowedPaths) {
		if (!disallow) continue;
		if (disallow === "/") return false;
		if (pathname.startsWith(disallow)) return false;
	}
	return true;
}
