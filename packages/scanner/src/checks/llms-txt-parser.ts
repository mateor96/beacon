/**
 * Pure parser for llms.txt markdown per the llmstxt.org specification.
 *
 * Extracted from `llms-txt.ts` (#233) so the same structural validator can
 * be reused by both the scanner check and the `@beacon/ai` generator. Pure
 * function — no I/O, no scanner runtime dependencies.
 */

export interface ParsedLlmsTxt {
	content: string;
	h1Lines: string[];
	hasBlockquote: boolean;
	h2Sections: string[];
	markdownLinks: RegExpMatchArray[];
	hasHtmlTags: boolean;
}

export function parseLlmsTxt(content: string): ParsedLlmsTxt {
	const lines = content.split("\n");

	const h1Lines = lines.filter((l) => /^# .+/.test(l));
	const hasBlockquote = lines.some((l) => /^> .+/.test(l));
	const h2Sections = lines.filter((l) => /^## .+/.test(l));
	const markdownLinks = [...content.matchAll(/- \[.+?\]\(.+?\)/g)];
	const hasHtmlTags = /<[a-z][a-z0-9]*[\s>]/i.test(content);

	return { content, h1Lines, hasBlockquote, h2Sections, markdownLinks, hasHtmlTags };
}
