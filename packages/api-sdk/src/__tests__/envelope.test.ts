import { describe, expect, it } from "vitest";
import {
	QueryParseError,
	buildItemEnvelope,
	buildListEnvelope,
	parseListQuery,
	projectFields,
} from "../envelope/index.js";

function params(obj: Record<string, string>): URLSearchParams {
	return new URLSearchParams(obj);
}

describe("parseListQuery (#261)", () => {
	it("applies defaults when all params absent", () => {
		const out = parseListQuery(params({}));
		expect(out).toEqual({
			cursor: null,
			limit: 20,
			fields: null,
			sort: null,
			filters: {},
		});
	});

	it("respects custom default limit", () => {
		expect(parseListQuery(params({}), { defaultLimit: 50 }).limit).toBe(50);
	});

	it("caps limit at maxLimit", () => {
		expect(parseListQuery(params({ limit: "9999" }), { maxLimit: 100 }).limit).toBe(100);
	});

	it("throws on negative limit", () => {
		expect(() => parseListQuery(params({ limit: "-1" }))).toThrow(QueryParseError);
	});

	it("throws on non-numeric limit", () => {
		expect(() => parseListQuery(params({ limit: "abc" }))).toThrow(QueryParseError);
	});

	it("parses comma-separated fields", () => {
		expect(parseListQuery(params({ fields: "id,domain,score" })).fields).toEqual([
			"id",
			"domain",
			"score",
		]);
	});

	it("validates fields against allowlist", () => {
		expect(() =>
			parseListQuery(params({ fields: "id,bad" }), {
				allowedFields: ["id", "score"],
			}),
		).toThrow(QueryParseError);
	});

	it("parses ascending sort by default", () => {
		expect(parseListQuery(params({ sort: "created_at" })).sort).toEqual({
			field: "created_at",
			direction: "asc",
		});
	});

	it("parses descending sort with - prefix", () => {
		expect(parseListQuery(params({ sort: "-created_at" })).sort).toEqual({
			field: "created_at",
			direction: "desc",
		});
	});

	it("rejects sort fields outside allowlist", () => {
		expect(() =>
			parseListQuery(params({ sort: "password" }), {
				allowedSortFields: ["created_at", "score"],
			}),
		).toThrow(QueryParseError);
	});

	it("collects non-reserved params as filters", () => {
		expect(
			parseListQuery(params({ domain: "example.com", score_gte: "70", limit: "5" })).filters,
		).toEqual({ domain: "example.com", score_gte: "70" });
	});

	it("treats empty fields string as null", () => {
		expect(parseListQuery(params({ fields: "" })).fields).toBeNull();
	});

	it("preserves cursor verbatim (no validation)", () => {
		expect(parseListQuery(params({ cursor: "abc123" })).cursor).toBe("abc123");
	});
});

describe("buildListEnvelope", () => {
	it("returns a shaped envelope for empty results", () => {
		const env = buildListEnvelope({
			items: [] as Array<{ id: string }>,
			limit: 20,
			nextCursor: null,
		});
		expect(env.data).toEqual([]);
		expect(env.meta.hasMore).toBe(false);
		expect(env.meta.nextCursor).toBeNull();
	});

	it("sets hasMore=true when nextCursor is present", () => {
		const env = buildListEnvelope({ items: [{ id: "a" }], limit: 1, nextCursor: "abc" });
		expect(env.meta.hasMore).toBe(true);
		expect(env.meta.nextCursor).toBe("abc");
	});

	it("includes total when provided", () => {
		const env = buildListEnvelope({ items: [], limit: 20, nextCursor: null, total: 42 });
		expect(env.meta.total).toBe(42);
	});

	it("omits total when not provided", () => {
		const env = buildListEnvelope({ items: [], limit: 20, nextCursor: null });
		expect(env.meta.total).toBeUndefined();
	});

	it("builds self + next links when requestUrl provided", () => {
		const env = buildListEnvelope({
			items: [],
			limit: 10,
			nextCursor: "xyz",
			requestUrl: "https://api.example.com/v1/scans?limit=10",
		});
		expect(env.links?.self).toBe("https://api.example.com/v1/scans?limit=10");
		expect(env.links?.next).toContain("cursor=xyz");
	});

	it("next link is null when nextCursor is null", () => {
		const env = buildListEnvelope({
			items: [],
			limit: 10,
			nextCursor: null,
			requestUrl: "https://api.example.com/v1/scans",
		});
		expect(env.links?.next).toBeNull();
	});
});

describe("buildItemEnvelope", () => {
	it("wraps a single object with empty meta by default", () => {
		expect(buildItemEnvelope({ id: "a" })).toEqual({ data: { id: "a" }, meta: {} });
	});

	it("merges meta when provided", () => {
		expect(buildItemEnvelope({ id: "a" }, { cached: true })).toEqual({
			data: { id: "a" },
			meta: { cached: true },
		});
	});
});

describe("projectFields", () => {
	it("returns the full item when fields is null", () => {
		expect(projectFields({ a: 1, b: 2 }, null)).toEqual({ a: 1, b: 2 });
	});

	it("projects only requested keys", () => {
		expect(projectFields({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
	});

	it("silently drops requested keys that don't exist", () => {
		expect(projectFields({ a: 1 }, ["a", "missing"])).toEqual({ a: 1 });
	});
});
