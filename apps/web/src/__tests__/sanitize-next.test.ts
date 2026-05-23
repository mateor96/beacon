import { sanitizeNext } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("sanitizeNext", () => {
	it("returns /dashboard for null", () => {
		expect(sanitizeNext(null)).toBe("/dashboard");
	});

	it("returns /dashboard for empty string", () => {
		expect(sanitizeNext("")).toBe("/dashboard");
	});

	it("allows valid paths starting with /", () => {
		expect(sanitizeNext("/settings")).toBe("/settings");
		expect(sanitizeNext("/dashboard/scans")).toBe("/dashboard/scans");
	});

	it("blocks open redirect with //", () => {
		expect(sanitizeNext("//evil.com")).toBe("/dashboard");
		expect(sanitizeNext("//evil.com/path")).toBe("/dashboard");
	});

	it("blocks open redirect with backslash", () => {
		expect(sanitizeNext("/\\evil.com")).toBe("/dashboard");
	});

	it("blocks control characters", () => {
		expect(sanitizeNext("/pricing\n/admin")).toBe("/dashboard");
		expect(sanitizeNext("/pricing\tadmin")).toBe("/dashboard");
	});

	it("blocks absolute URLs", () => {
		expect(sanitizeNext("https://evil.com")).toBe("/dashboard");
	});
});
