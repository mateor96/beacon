import { assertJsonContentType, assertSameOrigin, getAppOrigin } from "@/lib/request-guards";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function makeRequest(url: string, headers?: Record<string, string>): Request {
	return new Request(url, {
		method: "POST",
		headers: headers ?? {},
	});
}

// ── getAppOrigin ────────────────────────────────────────────

describe("getAppOrigin", () => {
	const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

	afterEach(() => {
		if (originalEnv === undefined) {
			// biome-ignore lint/performance/noDelete: actually unset env var for the next test
			delete process.env.NEXT_PUBLIC_APP_URL;
		} else {
			process.env.NEXT_PUBLIC_APP_URL = originalEnv;
		}
	});

	it("returns env-based origin when NEXT_PUBLIC_APP_URL is set", () => {
		process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
		const req = makeRequest("http://localhost:3000/api/scan");
		expect(getAppOrigin(req)).toBe("https://app.example.com");
	});

	it("falls back to request URL when NEXT_PUBLIC_APP_URL is unset", () => {
		// biome-ignore lint/performance/noDelete: actually unset env var
		delete process.env.NEXT_PUBLIC_APP_URL;
		const req = makeRequest("http://localhost:3000/api/scan");
		expect(getAppOrigin(req)).toBe("http://localhost:3000");
	});
});

// ── assertSameOrigin ────────────────────────────────────────

describe("assertSameOrigin", () => {
	const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

	beforeEach(() => {
		process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
	});

	afterEach(() => {
		if (originalEnv === undefined) {
			// biome-ignore lint/performance/noDelete: actually unset env var
			delete process.env.NEXT_PUBLIC_APP_URL;
		} else {
			process.env.NEXT_PUBLIC_APP_URL = originalEnv;
		}
	});

	it("allows same-origin request", () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			Origin: "http://localhost:3000",
		});
		expect(assertSameOrigin(req)).toBeNull();
	});

	it("allows missing Origin header (non-browser client)", () => {
		const req = makeRequest("http://localhost:3000/api/scan");
		expect(assertSameOrigin(req)).toBeNull();
	});

	it("rejects cross-origin request with 403", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			Origin: "https://evil.example",
		});
		const result = assertSameOrigin(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(403);
		const body = await result?.json();
		expect(body.error).toContain("ungültigen Herkunft");
	});

	it("rejects malformed Origin with 403", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			Origin: "not-a-url",
		});
		const result = assertSameOrigin(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(403);
	});

	it("rejects Origin 'null' string with 403 (sandboxed iframe)", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			Origin: "null",
		});
		const result = assertSameOrigin(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(403);
	});
});

// ── assertJsonContentType ───────────────────────────────────

describe("assertJsonContentType", () => {
	it("allows application/json", () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "application/json",
		});
		expect(assertJsonContentType(req)).toBeNull();
	});

	it("allows application/json with charset", () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "application/json; charset=utf-8",
		});
		expect(assertJsonContentType(req)).toBeNull();
	});

	it("allows APPLICATION/JSON (case-insensitive)", () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "APPLICATION/JSON",
		});
		expect(assertJsonContentType(req)).toBeNull();
	});

	it("rejects missing Content-Type with 415", async () => {
		const req = makeRequest("http://localhost:3000/api/scan");
		const result = assertJsonContentType(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(415);
		const body = await result?.json();
		expect(body.error).toContain("application/json");
	});

	it("rejects text/plain with 415", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "text/plain",
		});
		const result = assertJsonContentType(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(415);
	});

	it("rejects multipart/form-data with 415", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "multipart/form-data",
		});
		const result = assertJsonContentType(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(415);
	});

	it("rejects application/x-www-form-urlencoded with 415", async () => {
		const req = makeRequest("http://localhost:3000/api/scan", {
			"Content-Type": "application/x-www-form-urlencoded",
		});
		const result = assertJsonContentType(req);
		expect(result).not.toBeNull();
		expect(result?.status).toBe(415);
	});
});
