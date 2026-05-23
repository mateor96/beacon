/**
 * Extract `<a href="...">` targets from an HTML string. We only need
 * the URLs for BFS; the full HTML stays in the scanner's domain.
 *
 * Resolves relative paths against `baseUrl`. Drops javascript:, mailto:,
 * tel:, data: schemes. Strips fragments.
 */

const HREF_RE = /<a\s[^>]*href\s*=\s*["']([^"'#]+?)(?:#[^"']*)?["']/gi;

const REJECT_SCHEMES = ["javascript:", "mailto:", "tel:", "data:", "blob:"];

export function extractInternalLinks(html: string, baseUrl: string): string[] {
	const found = new Set<string>();
	let base: URL;
	try {
		base = new URL(baseUrl);
	} catch {
		return [];
	}

	for (const match of html.matchAll(HREF_RE)) {
		const raw = match[1]?.trim();
		if (!raw) continue;
		const lower = raw.toLowerCase();
		if (REJECT_SCHEMES.some((s) => lower.startsWith(s))) continue;
		try {
			const resolved = new URL(raw, base);
			// Same-origin only — cross-domain links are out of scope per #10.
			if (resolved.origin !== base.origin) continue;
			// Drop fragment-only links (e.g. "#section") and the trailing
			// slash normalisation is best-effort.
			resolved.hash = "";
			found.add(resolved.toString());
		} catch {
			// invalid url; skip
		}
	}
	return [...found];
}
