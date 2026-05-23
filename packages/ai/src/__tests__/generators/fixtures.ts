import type { ScanCheck, TokenUsage } from "@beacon/shared";
import { vi } from "vitest";
import type { FixGeneratorContext } from "../../generators/types.js";

export const SAMPLE_URL = "https://example.com";

export const SAMPLE_HTML = `<html>
<head>
<title>Example Corp - AI Solutions</title>
<meta name="description" content="We build AI-powered tools for businesses.">
</head>
<body>
<nav><a href="/about">About</a><a href="/products">Products</a></nav>
<h1>Welcome to Example Corp</h1>
<h2>Our Products</h2>
<p>${"We provide cutting-edge AI solutions for modern businesses. ".repeat(5)}</p>
<h2>About Us</h2>
<p>Founded in 2020, we are leaders in AI consulting and development.</p>
<footer>Copyright 2024</footer>
</body>
</html>`;

export const MINIMAL_HTML = "<html><body><p>short</p></body></html>";

export const mockUsage: TokenUsage = {
	inputTokens: 500,
	outputTokens: 300,
	model: "claude-haiku-4-5-20251001",
	operation: "fix-generation",
	durationMs: 800,
};

export function createMockClient(responseText: string) {
	return {
		complete: vi.fn().mockResolvedValue({
			text: responseText,
			usage: mockUsage,
		}),
	} as never;
}

export function createScanCheck(id: string, overrides: Partial<ScanCheck> = {}): ScanCheck {
	return {
		id: id as ScanCheck["id"],
		name: id,
		status: "fail",
		category: "readability",
		severity: "important",
		score: 20,
		summary: `${id} check failed`,
		issues: [{ message: "Missing or incomplete", severity: "important" }],
		details: {},
		...overrides,
	};
}

export function createContext(
	checkId: string,
	overrides: Partial<FixGeneratorContext> = {},
): FixGeneratorContext {
	return {
		url: SAMPLE_URL,
		html: SAMPLE_HTML,
		check: createScanCheck(checkId),
		...overrides,
	};
}

export const VALID_LLMS_TXT_RESPONSE = JSON.stringify({
	checkId: "llms-txt",
	content:
		"# Example Corp\\n\\n> AI solutions for businesses.\\n\\n## Products\\n\\n- [AI Tools](/products): Our main product line\\n\\n## About\\n\\n- [About Us](/about): Learn more about our company",
	filename: "llms.txt",
	method: "ai-generated",
});

export const VALID_SCHEMA_ORG_RESPONSE = JSON.stringify({
	checkId: "schema-org",
	content:
		'{"@context":"https://schema.org","@type":"Organization","name":"Example Corp","url":"https://example.com"}',
	filename: "schema.jsonld",
	method: "ai-generated",
});

export const VALID_META_TAGS_RESPONSE = JSON.stringify({
	checkId: "meta-tags",
	content:
		'<meta property="og:title" content="Example Corp">\\n<meta property="og:description" content="AI solutions for businesses">',
	filename: "meta-tags.html",
	method: "ai-generated",
});

export const VALID_AGENTS_MD_RESPONSE = JSON.stringify({
	checkId: "agents-md",
	content:
		"# Example Corp\\n\\n## General\\n\\nAI solutions provider.\\n\\n## Agents\\n\\n- Content indexing\\n- Search\\n\\n## Capabilities\\n\\n- Read public pages\\n- Index content\\n\\n## Data & Privacy\\n\\nRespect robots.txt\\n\\n## Contact\\n\\ncontact@example.com",
	filename: "agents.md",
	method: "ai-generated",
});
