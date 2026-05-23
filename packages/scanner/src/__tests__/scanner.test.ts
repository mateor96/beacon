import type { CheckPlugin, ScanCheck } from "@beacon/shared";
import { describe, expect, it, vi } from "vitest";
import { FetchError } from "../fetcher.js";
import { CheckRegistry } from "../registry.js";
import { ScannerEngine } from "../scanner.js";

vi.mock("../fetcher.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../fetcher.js")>();
	return {
		...actual,
		fetchUrl: vi.fn().mockResolvedValue({
			html: "<html><body>test</body></html>",
			statusCode: 200,
			responseTime: 100,
			redirects: [],
			finalUrl: "https://example.com",
		}),
	};
});

vi.mock("../prefetch.js", () => ({
	prefetchSubResources: vi.fn().mockResolvedValue({}),
}));

import { fetchUrl } from "../fetcher.js";

function makePlugin(
	overrides: Partial<CheckPlugin> & { run?: CheckPlugin["run"] } = {},
): CheckPlugin {
	return {
		id: "llms-txt",
		name: "llms.txt",
		category: "readability",
		severity: "critical",
		run: async () => ({
			id: "llms-txt",
			name: "llms.txt",
			status: "pass" as const,
			category: "readability" as const,
			severity: "critical" as const,
			score: 100,
			summary: "OK",
			issues: [],
		}),
		...overrides,
	};
}

describe("ScannerEngine", () => {
	it("returns failed status when fetch fails", async () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());
		const engine = new ScannerEngine(registry);

		vi.mocked(fetchUrl).mockRejectedValueOnce(
			new FetchError("Fetch failed for https://example.com: connect error", "FETCH_FAILED"),
		);

		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("failed");
		expect(result.error).toBeDefined();
		expect(result.completedAt).toBeDefined();
		expect(result.checks).toHaveLength(0);
		expect(result.overallScore).toBe(0);
	});

	it("handles plugin exceptions gracefully", async () => {
		const registry = new CheckRegistry();
		const crashingPlugin = makePlugin({
			id: "llms-txt",
			run: async () => {
				throw new Error("Plugin crashed!");
			},
		});
		registry.register(crashingPlugin);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("completed");
		expect(result.checks).toHaveLength(1);

		const check = result.checks[0];
		expect(check).toBeDefined();
		if (!check) {
			throw new Error("Expected exactly one check result");
		}
		expect(check.status).toBe("error");
		expect(check.summary).toContain("Plugin crashed!");
	});

	it("handles synchronous plugin throw without aborting scan", async () => {
		const registry = new CheckRegistry();
		const syncThrowPlugin = makePlugin({
			id: "llms-txt",
			run: (() => {
				throw new Error("Sync throw!");
			}) as unknown as CheckPlugin["run"],
		});
		registry.register(syncThrowPlugin);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("completed");
		expect(result.checks).toHaveLength(1);

		const check = result.checks[0];
		if (!check) throw new Error("expected at least one check result");
		expect(check.status).toBe("error");
		expect(check.score).toBe(0);
		expect(check.summary).toContain("Sync throw!");
	});

	it("isolates synchronous throw from other plugins", async () => {
		const registry = new CheckRegistry();
		registry.register(
			makePlugin({
				id: "llms-txt",
				run: (() => {
					throw new Error("sync crash");
				}) as unknown as CheckPlugin["run"],
			}),
		);
		registry.register(
			makePlugin({
				id: "robots-txt",
				name: "robots.txt",
				run: async () => ({
					id: "robots-txt",
					name: "robots.txt",
					status: "pass" as const,
					category: "readability" as const,
					severity: "important" as const,
					score: 100,
					summary: "OK",
					issues: [],
				}),
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("completed");
		expect(result.checks).toHaveLength(2);

		const failCheck = result.checks.find((c) => c.id === "llms-txt");
		if (!failCheck) throw new Error("expected llms-txt check in result");
		expect(failCheck.status).toBe("error");
		expect(failCheck.summary).toContain("sync crash");

		const passCheck = result.checks.find((c) => c.id === "robots-txt");
		if (!passCheck) throw new Error("expected robots-txt check in result");
		expect(passCheck.status).toBe("pass");
		expect(passCheck.score).toBe(100);
	});

	it("creates engine with default registry", () => {
		const engine = new ScannerEngine();
		expect(engine).toBeInstanceOf(ScannerEngine);
	});

	it("creates engine with custom registry", () => {
		const registry = new CheckRegistry();
		const engine = new ScannerEngine(registry);
		expect(engine).toBeInstanceOf(ScannerEngine);
	});

	it("returns failed for empty registry", async () => {
		const registry = new CheckRegistry();
		const engine = new ScannerEngine(registry);

		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("failed");
		expect(result.error).toBe("No check plugins registered");
		expect(result.completedAt).toBeDefined();
		expect(result.checks).toHaveLength(0);
		expect(result.overallScore).toBe(0);
	});

	it("runs multiple plugins in parallel", async () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin({ id: "llms-txt", name: "llms.txt" }));
		registry.register(
			makePlugin({
				id: "robots-txt",
				name: "robots.txt",
				run: async () => ({
					id: "robots-txt",
					name: "robots.txt",
					status: "pass" as const,
					category: "readability" as const,
					severity: "important" as const,
					score: 100,
					summary: "OK",
					issues: [],
				}),
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("completed");
		expect(result.checks).toHaveLength(2);

		const ids = result.checks.map((c) => c.id);
		expect(ids).toContain("llms-txt");
		expect(ids).toContain("robots-txt");
	});

	it("uses finalUrl after redirect as context url", async () => {
		vi.mocked(fetchUrl).mockResolvedValueOnce({
			html: "<html><body>redirected</body></html>",
			statusCode: 200,
			responseTime: 150,
			redirects: ["https://www.example.com/"],
			finalUrl: "https://www.example.com/",
		});

		const registry = new CheckRegistry();
		let capturedCtxUrl = "";
		let capturedInputUrl = "";
		registry.register(
			makePlugin({
				run: async (ctx) => {
					capturedCtxUrl = ctx.finalUrl;
					capturedInputUrl = ctx.inputUrl;
					return {
						id: "llms-txt",
						name: "llms.txt",
						status: "pass" as const,
						category: "readability" as const,
						severity: "critical" as const,
						score: 100,
						summary: "OK",
						issues: [],
					};
				},
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		// ctx.finalUrl inside check should be the final (post-redirect) URL
		expect(capturedCtxUrl).toBe("https://www.example.com/");
		// ctx.inputUrl inside check should be the original user-supplied URL
		expect(capturedInputUrl).toBe("https://example.com");
		// ScanResult.url preserves the original user-supplied URL
		expect(result.url).toBe("https://example.com");
		// ScanResult.finalUrl exposes the post-redirect URL
		expect(result.finalUrl).toBe("https://www.example.com/");
	});

	it("sets finalUrl same as url when no redirects", async () => {
		const registry = new CheckRegistry();
		registry.register(makePlugin());
		const engine = new ScannerEngine(registry);

		const result = await engine.scan("https://example.com");

		expect(result.url).toBe("https://example.com");
		expect(result.finalUrl).toBe("https://example.com");
	});

	it("calculates correct scores", async () => {
		const registry = new CheckRegistry();
		registry.register(
			makePlugin({
				id: "llms-txt",
				severity: "critical",
				run: async () => ({
					id: "llms-txt",
					name: "llms.txt",
					status: "fail" as const,
					category: "readability" as const,
					severity: "critical" as const,
					score: 0,
					summary: "Missing",
					issues: [{ message: "Not found", severity: "critical" as const }],
				}),
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		expect(result.status).toBe("completed");
		// Weighted average: single llms-txt (weight 12) with score 0 → 0*12/12 = 0
		expect(result.overallScore).toBe(0);
		expect(result.readinessLevel).toBe(0); // scoreToLevel(0) = Level 0
		expect(result.levelScores).toEqual({
			readability: 0, // single readability check scoring 0
			interactivity: null, // no checks → null
			transactional: null, // no checks → null
		});
	});

	it("skips fetchUrl when prefetchedResult is provided", async () => {
		vi.mocked(fetchUrl).mockClear();

		const registry = new CheckRegistry();
		registry.register(makePlugin());
		const engine = new ScannerEngine(registry);

		const prefetchedResult = {
			html: "<html><body>prefetched</body></html>",
			statusCode: 200,
			responseTime: 100,
			redirects: [],
			finalUrl: "https://example.com",
		};

		const result = await engine.scan("https://example.com", { prefetchedResult });

		expect(result.status).toBe("completed");
		expect(result.finalUrl).toBe("https://example.com");
		expect(fetchUrl).not.toHaveBeenCalled();
	});

	it("level scores use registry category, not plugin-returned category", async () => {
		const registry = new CheckRegistry();
		registry.register(
			makePlugin({
				id: "llms-txt",
				category: "readability",
				severity: "critical",
				run: async () => ({
					id: "llms-txt",
					name: "llms.txt",
					status: "fail" as const,
					category: "transactional" as const, // DRIFTED — registry says "readability"
					severity: "critical" as const,
					score: 0,
					summary: "Missing",
					issues: [{ message: "Not found", severity: "critical" as const }],
				}),
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		// Registry wins: readability gets the 0 score, not transactional
		expect(result.levelScores).toEqual({
			readability: 0, // single readability check scoring 0
			interactivity: null, // no checks → null
			transactional: null, // unaffected despite drifted category
		});
	});

	it("calculates per-category level scores with multiple categories", async () => {
		const registry = new CheckRegistry();
		registry.register(
			makePlugin({
				id: "llms-txt",
				category: "readability",
				severity: "critical",
				run: async () => ({
					id: "llms-txt",
					name: "llms.txt",
					status: "fail" as const,
					category: "readability" as const,
					severity: "critical" as const,
					score: 0,
					summary: "Missing",
					issues: [{ message: "Not found", severity: "critical" as const }],
				}),
			}),
		);
		registry.register(
			makePlugin({
				id: "agents-md",
				name: "AGENTS.md",
				category: "interactivity",
				severity: "nice-to-have",
				run: async () => ({
					id: "agents-md",
					name: "AGENTS.md",
					status: "fail" as const,
					category: "interactivity" as const,
					severity: "nice-to-have" as const,
					score: 0,
					summary: "Missing",
					issues: [{ message: "Not found", severity: "nice-to-have" as const }],
				}),
			}),
		);

		const engine = new ScannerEngine(registry);
		const result = await engine.scan("https://example.com");

		// Weighted average: llms-txt (weight 7, score 0) + agents-md (weight 0, score 0)
		// (0*7 + 0*0) / 7 = 0
		expect(result.overallScore).toBe(0);
		expect(result.readinessLevel).toBe(0); // scoreToLevel(0) = Level 0
		expect(result.levelScores).toEqual({
			readability: 0, // llms-txt scoring 0
			interactivity: null, // agents-md weight=0 → no weighted checks → null
			transactional: null, // no checks → null
		});
	});
});
