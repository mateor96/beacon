import { normalizeUrl } from "./normalize-url.js";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const INLINE_URL_PATTERN = /(?<!\()(?<!\]\()(?<!<)\bhttps?:\/\/[^\s<>"'\]\[)]+/g;
const ANGLE_BRACKET_URL_PATTERN = /<(https?:\/\/[^\s<>]+)>/g;
const FOOTNOTE_URL_PATTERN = /\[(\d+)\][:.\s]+\s*(https?:\/\/[^\s<>)]+)/g;
const CONTEXT_WINDOW_CHARS = 250;
const MAX_SNIPPET_CHARS = 500;

export interface ExtractedCitation {
	rawUrl: string;
	normalizedUrl: string;
	domain: string;
	position: number;
	contextSnippet: string;
}

function extractContextSnippet(text: string, offset: number, matchLength: number): string {
	const start = Math.max(0, offset - CONTEXT_WINDOW_CHARS);
	const end = Math.min(text.length, offset + matchLength + CONTEXT_WINDOW_CHARS);
	const snippet = text.slice(start, end).trim();
	if (snippet.length <= MAX_SNIPPET_CHARS) return snippet;
	return snippet.slice(0, MAX_SNIPPET_CHARS);
}

/**
 * Extract URL citations from an LLM response text. Supports:
 * - Markdown links `[text](https://...)`
 * - Inline URLs `https://...`
 *
 * Returns citations in document order with absolute positions and context snippets.
 * URLs that fail to parse or aren't http(s) are skipped.
 * Duplicates (same normalized URL) are kept as separate citations — dedup happens
 * at the cited_pages table level, not at extraction time.
 */
export function extractCitations(text: string): ExtractedCitation[] {
	const seenOffsets = new Set<number>();
	const citations: ExtractedCitation[] = [];

	const urlEndCovered = new Set<number>();

	MARKDOWN_LINK_PATTERN.lastIndex = 0;
	let mdMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
	while ((mdMatch = MARKDOWN_LINK_PATTERN.exec(text)) !== null) {
		const rawUrl = mdMatch[2];
		const offset = mdMatch.index;
		const normalized = normalizeUrl(rawUrl);
		if (!normalized) continue;
		seenOffsets.add(offset);
		for (let i = offset; i < offset + mdMatch[0].length; i++) urlEndCovered.add(i);
		citations.push({
			rawUrl,
			normalizedUrl: normalized.url,
			domain: normalized.domain,
			position: offset,
			contextSnippet: extractContextSnippet(text, offset, mdMatch[0].length),
		});
	}

	ANGLE_BRACKET_URL_PATTERN.lastIndex = 0;
	let angleMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
	while ((angleMatch = ANGLE_BRACKET_URL_PATTERN.exec(text)) !== null) {
		const rawUrl = angleMatch[1];
		const offset = angleMatch.index;
		const normalized = normalizeUrl(rawUrl);
		if (!normalized) continue;
		seenOffsets.add(offset);
		for (let i = offset; i < offset + angleMatch[0].length; i++) urlEndCovered.add(i);
		citations.push({
			rawUrl,
			normalizedUrl: normalized.url,
			domain: normalized.domain,
			position: offset,
			contextSnippet: extractContextSnippet(text, offset, angleMatch[0].length),
		});
	}

	FOOTNOTE_URL_PATTERN.lastIndex = 0;
	let footMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
	while ((footMatch = FOOTNOTE_URL_PATTERN.exec(text)) !== null) {
		const rawUrl = footMatch[2].replace(/[.,;:!?)\]]+$/, "");
		const offset = footMatch.index;
		if (urlEndCovered.has(offset)) continue;
		const normalized = normalizeUrl(rawUrl);
		if (!normalized) continue;
		seenOffsets.add(offset);
		for (let i = offset; i < offset + footMatch[0].length; i++) urlEndCovered.add(i);
		citations.push({
			rawUrl,
			normalizedUrl: normalized.url,
			domain: normalized.domain,
			position: offset,
			contextSnippet: extractContextSnippet(text, offset, footMatch[0].length),
		});
	}

	INLINE_URL_PATTERN.lastIndex = 0;
	let inlineMatch: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex iteration
	while ((inlineMatch = INLINE_URL_PATTERN.exec(text)) !== null) {
		const offset = inlineMatch.index;
		if (urlEndCovered.has(offset)) continue;
		const rawUrl = inlineMatch[0].replace(/[.,;:!?)\]]+$/, "");
		const normalized = normalizeUrl(rawUrl);
		if (!normalized) continue;
		citations.push({
			rawUrl,
			normalizedUrl: normalized.url,
			domain: normalized.domain,
			position: offset,
			contextSnippet: extractContextSnippet(text, offset, rawUrl.length),
		});
	}

	citations.sort((a, b) => a.position - b.position);
	return citations;
}
