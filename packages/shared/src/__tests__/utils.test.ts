import { describe, expect, it } from "vitest";
import { isHtmlResponse } from "../utils";

describe("isHtmlResponse", () => {
	it("detects DOCTYPE", () => {
		expect(isHtmlResponse("<!DOCTYPE html><html><body></body></html>")).toBe(true);
	});
	it("detects lowercase <html", () => {
		expect(isHtmlResponse("<html><body></body></html>")).toBe(true);
	});
	it("detects uppercase <HTML", () => {
		expect(isHtmlResponse("<HTML><BODY></BODY></HTML>")).toBe(true);
	});
	it("detects with leading whitespace", () => {
		expect(isHtmlResponse("  \n  <!DOCTYPE html>")).toBe(true);
	});
	it("returns false for XML", () => {
		expect(isHtmlResponse('<?xml version="1.0"?><urlset></urlset>')).toBe(false);
	});
	it("returns false for plain text", () => {
		expect(isHtmlResponse("User-agent: *\nDisallow: /")).toBe(false);
	});
	it("returns false for JSON", () => {
		expect(isHtmlResponse('{"@context":"https://schema.org"}')).toBe(false);
	});
	it("returns false for empty string", () => {
		expect(isHtmlResponse("")).toBe(false);
	});
	it("returns false for markdown", () => {
		expect(isHtmlResponse("# Title\n\nSome content")).toBe(false);
	});
});
