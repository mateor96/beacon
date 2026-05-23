import { describe, expect, it } from "vitest";
import { UTF8_BOM, buildHeader, buildRow, escapeCell } from "../lib/csv-export/formatter.js";

describe("escapeCell (#225)", () => {
	it("returns empty string for null/undefined", () => {
		expect(escapeCell(null)).toBe("");
		expect(escapeCell(undefined)).toBe("");
	});

	it("returns plain values unwrapped", () => {
		expect(escapeCell("hello")).toBe("hello");
		expect(escapeCell(42)).toBe("42");
		expect(escapeCell(true)).toBe("true");
	});

	it("wraps cells containing commas in quotes", () => {
		expect(escapeCell("a,b")).toBe('"a,b"');
	});

	it("wraps cells containing quotes and doubles them", () => {
		expect(escapeCell('he said "hi"')).toBe('"he said ""hi"""');
	});

	it("wraps cells containing newlines", () => {
		expect(escapeCell("line1\nline2")).toBe('"line1\nline2"');
		expect(escapeCell("line1\r\nline2")).toBe('"line1\r\nline2"');
	});

	it("converts Date to ISO string", () => {
		expect(escapeCell(new Date("2026-04-21T12:00:00Z"))).toBe("2026-04-21T12:00:00.000Z");
	});

	it("JSON-stringifies plain objects", () => {
		expect(escapeCell({ a: 1 })).toBe('"{""a"":1}"');
	});
});

describe("buildHeader", () => {
	it("joins columns with comma + CRLF", () => {
		expect(buildHeader(["a", "b", "c"])).toBe("a,b,c\r\n");
	});

	it("escapes complex column names", () => {
		expect(buildHeader(["a,b", "c"])).toBe('"a,b",c\r\n');
	});
});

describe("buildRow", () => {
	it("projects record fields by column order", () => {
		expect(buildRow({ a: 1, b: 2, c: 3 }, ["b", "a"])).toBe("2,1\r\n");
	});

	it("emits empty for missing keys", () => {
		expect(buildRow({ a: 1 }, ["a", "missing"])).toBe("1,\r\n");
	});
});

describe("UTF8_BOM", () => {
	it("is the standard UTF-8 BOM byte order mark", () => {
		expect(UTF8_BOM).toBe("\uFEFF");
	});
});
