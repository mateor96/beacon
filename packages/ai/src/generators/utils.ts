// Shared utilities for fix generators

export function extractText(html: string, maxChars = 8000): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<nav[\s\S]*?<\/nav>/gi, "")
		.replace(/<footer[\s\S]*?<\/footer>/gi, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxChars);
}

export interface SiteInfo {
	title: string | null;
	metaDescription: string | null;
	headings: string[];
	bodyText: string;
}

export function extractSiteInfo(html: string): SiteInfo {
	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const title = titleMatch ? titleMatch[1].trim() : null;

	const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
	const metaDescription = descMatch ? descMatch[1].trim() : null;

	const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
	const headings: string[] = [];
	for (const m of html.matchAll(headingRegex)) {
		if (headings.length >= 10) break;
		const text = m[1].replace(/<[^>]+>/g, "").trim();
		if (text) headings.push(text);
	}

	const bodyText = extractText(html, 4000);

	return { title, metaDescription, headings, bodyText };
}

export function extractHeadSection(html: string, maxChars = 3000): string {
	const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
	if (headMatch) return headMatch[1].trim().slice(0, maxChars);
	return "";
}

export function extractExistingJsonLd(html: string): string[] {
	const blocks: string[] = [];
	const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	for (const m of html.matchAll(regex)) {
		blocks.push(m[1].trim());
	}
	return blocks;
}

// ── Error classification (shared across fix generators) ──────

/**
 * Returns true if the error from the Claude client should propagate up so
 * BullMQ retries the job (e.g. rate limit, transient 5xx, network, auth).
 * False means it's safe to fall back to the deterministic template
 * (e.g. malformed request that the operator must fix in code).
 *
 * Extracted from llms-txt.ts + schema-org.ts in #247 (third generator).
 *
 * Review history:
 *  - P1 #4: 429 + 5xx + network propagation
 *  - PR #353 review: 401 / 403 added so that a rotated or revoked Claude
 *    key fails loud instead of silently degrading every scan to template
 *    until someone notices.
 */
export function shouldPropagate(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const status = (err as { status?: unknown }).status;
	if (typeof status === "number") {
		if (status === 401 || status === 403) return true;
		if (status === 429) return true;
		if (status >= 500 && status < 600) return true;
		return false;
	}
	const code = (err as { code?: unknown }).code;
	if (typeof code === "string") {
		if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENETUNREACH") return true;
	}
	const name = (err as { name?: unknown }).name;
	if (name === "APIConnectionError" || name === "APIConnectionTimeoutError") return true;
	if (name === "AuthenticationError" || name === "PermissionDeniedError") return true;
	return false;
}
