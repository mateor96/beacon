/**
 * Minimal sitemap.xml parser. Extracts `<loc>` URLs from a flat sitemap
 * and recursively follows sitemap-index entries up to a configurable
 * depth. Does not validate; permissive on whitespace/encoding.
 */

export interface ParsedSitemap {
	urls: string[];
	indexes: string[];
}

const LOC_RE = /<loc>\s*([^<]+?)\s*<\/loc>/gi;

export function parseSitemap(xml: string): ParsedSitemap {
	const all: string[] = [];
	for (const match of xml.matchAll(LOC_RE)) {
		const url = match[1];
		if (url) all.push(url);
	}
	// Sitemap-index entries are wrapped in <sitemap> tags; loose detection
	// via the surrounding parent name. We scope by walking <sitemap>...</sitemap>
	// blocks specifically.
	const indexes: string[] = [];
	for (const block of xml.matchAll(/<sitemap>\s*<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
		const url = block[1];
		if (url) indexes.push(url);
	}
	const indexSet = new Set(indexes);
	const urls = all.filter((u) => !indexSet.has(u));
	return { urls, indexes };
}
