import { describe, expect, it } from "vitest";
import {
	extractRedditUrls,
	isRedditUrl,
	matchCitationsToMentions,
	parseRedditUrl,
} from "../reddit-citation-linker.js";

describe("parseRedditUrl", () => {
	it("parses a canonical post URL", () => {
		const out = parseRedditUrl("https://www.reddit.com/r/SideProject/comments/1abc23/my_post/");
		expect(out).toEqual({ subreddit: "sideproject", postId: "1abc23", commentId: null });
	});

	it("parses an old.reddit.com URL", () => {
		const out = parseRedditUrl("https://old.reddit.com/r/programming/comments/2xyz45/title");
		expect(out.postId).toBe("2xyz45");
		expect(out.subreddit).toBe("programming");
	});

	it("parses a comment permalink", () => {
		const out = parseRedditUrl(
			"https://www.reddit.com/r/SideProject/comments/1abc23/my_post/h7k9pq2",
		);
		expect(out).toEqual({ subreddit: "sideproject", postId: "1abc23", commentId: "h7k9pq2" });
	});

	it("parses URL without www prefix", () => {
		const out = parseRedditUrl("https://reddit.com/r/test/comments/abc/title");
		expect(out.postId).toBe("abc");
	});

	it("parses URL without protocol", () => {
		const out = parseRedditUrl("reddit.com/r/test/comments/abc/title");
		expect(out.postId).toBe("abc");
	});

	it("normalises subreddit to lowercase", () => {
		const out = parseRedditUrl("https://www.reddit.com/r/SideProject/comments/abc/t");
		expect(out.subreddit).toBe("sideproject");
	});

	it("returns nulls for non-Reddit URL", () => {
		expect(parseRedditUrl("https://example.com/foo")).toEqual({
			subreddit: null,
			postId: null,
			commentId: null,
		});
	});

	it("returns nulls for empty string", () => {
		expect(parseRedditUrl("")).toEqual({ subreddit: null, postId: null, commentId: null });
	});

	it("handles m.reddit.com subdomain", () => {
		expect(parseRedditUrl("https://m.reddit.com/r/test/comments/abc/title").postId).toBe("abc");
	});

	it("does not match user profile URLs", () => {
		expect(parseRedditUrl("https://www.reddit.com/user/someone").postId).toBeNull();
	});
});

describe("isRedditUrl", () => {
	it("returns true for any URL that parses", () => {
		expect(isRedditUrl("https://reddit.com/r/test/comments/abc/title")).toBe(true);
	});
	it("returns false otherwise", () => {
		expect(isRedditUrl("https://example.com")).toBe(false);
	});
});

describe("extractRedditUrls", () => {
	it("finds a single URL", () => {
		const urls = extractRedditUrls(
			"See https://www.reddit.com/r/test/comments/abc/title for details.",
		);
		expect(urls).toHaveLength(1);
	});

	it("finds multiple URLs and deduplicates", () => {
		const urls = extractRedditUrls(
			"Here: https://reddit.com/r/a/comments/x/t and https://reddit.com/r/a/comments/x/t again.",
		);
		expect(urls).toHaveLength(1);
	});

	it("ignores non-Reddit URLs", () => {
		expect(
			extractRedditUrls("Just https://example.com/foo and https://news.ycombinator.com"),
		).toEqual([]);
	});

	it("finds URLs inside markdown brackets", () => {
		const urls = extractRedditUrls("[link](https://reddit.com/r/a/comments/x/t)");
		expect(urls).toHaveLength(1);
	});
});

describe("matchCitationsToMentions", () => {
	const citations = [
		{
			id: "cit-1",
			rawResponse: "Check https://reddit.com/r/test/comments/p1/title for more.",
		},
		{
			id: "cit-2",
			rawResponse:
				"See https://reddit.com/r/test/comments/p1/title/c2 and https://reddit.com/r/other/comments/p2/title",
		},
		{ id: "cit-3", rawResponse: "No reddit here." },
	];

	it("returns exact matches with confidence 1.0 for known posts", () => {
		const out = matchCitationsToMentions(citations, new Set(["p1"]), new Set());
		const cit1 = out.find((c) => c.citationId === "cit-1");
		expect(cit1?.confidenceScore).toBe(1.0);
		expect(cit1?.mentionType).toBe("post");
	});

	it("returns exact matches for known comments with confidence 1.0", () => {
		const out = matchCitationsToMentions(citations, new Set(["p1"]), new Set(["c2"]));
		const cit2 = out.filter((c) => c.citationId === "cit-2");
		const commentLink = cit2.find((c) => c.mentionType === "comment");
		expect(commentLink?.confidenceScore).toBe(1.0);
		expect(commentLink?.mentionRedditId).toBe("c2");
	});

	it("returns 0.7 confidence when the comment is cited but only the post is known", () => {
		// Citation cites comment c2 under post p1. Only p1 is known, c2 is unknown.
		const out = matchCitationsToMentions(citations, new Set(["p1"]), new Set());
		const cit2Post = out.find((c) => c.citationId === "cit-2" && c.mentionType === "post");
		expect(cit2Post?.confidenceScore).toBe(0.7);
	});

	it("returns [] when no known posts or comments match", () => {
		expect(matchCitationsToMentions(citations, new Set(), new Set())).toEqual([]);
	});

	it("ignores citations without Reddit URLs", () => {
		const out = matchCitationsToMentions(citations, new Set(["p1"]), new Set());
		expect(out.find((c) => c.citationId === "cit-3")).toBeUndefined();
	});

	it("dedupes when the same citation+mention appears multiple times", () => {
		const cits = [
			{
				id: "cit",
				rawResponse:
					"https://reddit.com/r/a/comments/p/t and https://reddit.com/r/a/comments/p/t again",
			},
		];
		expect(matchCitationsToMentions(cits, new Set(["p"]), new Set())).toHaveLength(1);
	});
});
