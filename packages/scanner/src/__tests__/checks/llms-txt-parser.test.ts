import { describe, expect, it } from "vitest";
import { parseLlmsTxt } from "../../checks/llms-txt-parser.js";

describe("parseLlmsTxt", () => {
	it("counts H1 lines", () => {
		const result = parseLlmsTxt("# Title\n\n## Section");
		expect(result.h1Lines).toEqual(["# Title"]);
	});

	it("rejects multiple H1 lines", () => {
		const result = parseLlmsTxt("# First\n# Second\n");
		expect(result.h1Lines).toHaveLength(2);
	});

	it("detects a blockquote", () => {
		expect(parseLlmsTxt("# T\n> summary").hasBlockquote).toBe(true);
		expect(parseLlmsTxt("# T\nplain").hasBlockquote).toBe(false);
	});

	it("counts H2 sections", () => {
		const result = parseLlmsTxt("# T\n## A\n## B\n## C");
		expect(result.h2Sections).toEqual(["## A", "## B", "## C"]);
	});

	it("matches markdown link list items", () => {
		const md = "- [Home](https://example.com): main page\n- [About](https://example.com/about)";
		const result = parseLlmsTxt(md);
		expect(result.markdownLinks).toHaveLength(2);
	});

	it("flags HTML tag presence", () => {
		expect(parseLlmsTxt("# T\n<div>raw</div>").hasHtmlTags).toBe(true);
		expect(parseLlmsTxt("# T\n5 < 6 and 6 > 5").hasHtmlTags).toBe(false);
	});

	it("preserves the original content on the result", () => {
		const md = "# T\n> s\n## A\n- [x](y): z";
		expect(parseLlmsTxt(md).content).toBe(md);
	});
});
