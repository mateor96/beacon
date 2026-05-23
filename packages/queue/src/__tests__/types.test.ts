import { describe, expect, it } from "vitest";
import { QUEUE_CONFIG, QUEUE_NAMES } from "../config";
import type { FixJobData, ReportJobData, ScanJobData } from "../types";

describe("QUEUE_NAMES", () => {
	it("contains all required queue names", () => {
		expect(QUEUE_NAMES).toEqual([
			"scan",
			"fix",
			"report",
			"analysis",
			"email",
			"public-audit",
			"ai-visibility",
			"llms-txt",
			"json-ld",
			"agents-md",
			"roi-report",
			"rollback",
			"deploy",
			"validate-deployment",
			"citation-extraction",
			"csv-export",
		]);
	});
});

describe("QUEUE_CONFIG", () => {
	it("has entry for each queue name", () => {
		for (const name of QUEUE_NAMES) {
			expect(QUEUE_CONFIG[name]).toBeDefined();
			expect(QUEUE_CONFIG[name].concurrency).toBeGreaterThan(0);
			expect(QUEUE_CONFIG[name].defaultJobOptions.attempts).toBeGreaterThan(0);
		}
	});
});

describe("Job data interfaces", () => {
	it("ScanJobData requires scanId and url", () => {
		const data: ScanJobData = { scanId: "s1", url: "https://example.com" };
		expect(data.scanId).toBe("s1");
		expect(data.url).toBe("https://example.com");
	});

	it("FixJobData requires scanId and checkIds", () => {
		const data: FixJobData = { scanId: "s1", checkIds: ["llms-txt"] };
		expect(data.scanId).toBe("s1");
		expect(data.checkIds).toEqual(["llms-txt"]);
	});

	it("ReportJobData requires scanId and format", () => {
		const data: ReportJobData = { scanId: "s1", format: "pdf" };
		expect(data.scanId).toBe("s1");
		expect(data.format).toBe("pdf");
	});
});

describe("QUEUE_CONFIG retry policy", () => {
	it("scan has 3 attempts with 2s exponential backoff", () => {
		expect(QUEUE_CONFIG.scan.defaultJobOptions.attempts).toBe(3);
		expect(QUEUE_CONFIG.scan.defaultJobOptions.backoff).toEqual({
			type: "exponential",
			delay: 2_000,
		});
	});

	it("fix/report/analysis have 2 attempts with 5s exponential backoff", () => {
		for (const name of ["fix", "report", "analysis"] as const) {
			expect(QUEUE_CONFIG[name].defaultJobOptions.attempts).toBe(2);
			expect(QUEUE_CONFIG[name].defaultJobOptions.backoff).toEqual({
				type: "exponential",
				delay: 5_000,
			});
		}
	});
});

describe("QUEUE_CONFIG retention defaults", () => {
	// email, validate-deployment, and csv-export have user-visible artifacts
	// or long post-mortem windows that benefit from longer retention;
	// everything else uses the default bucket.
	const LONG_RETENTION = new Set(["email", "validate-deployment", "csv-export"]);

	it("removeOnComplete is 3600s (1h) for standard queues and 86400s (24h) for long-retention queues", () => {
		for (const name of QUEUE_NAMES) {
			const expected = LONG_RETENTION.has(name) ? { age: 86_400 } : { age: 3_600 };
			expect(QUEUE_CONFIG[name].defaultJobOptions.removeOnComplete).toEqual(expected);
		}
	});

	it("removeOnFail is 86400s (24h) for standard queues and 604800s (7d) for long-retention queues", () => {
		for (const name of QUEUE_NAMES) {
			const expected = LONG_RETENTION.has(name) ? { age: 604_800 } : { age: 86_400 };
			expect(QUEUE_CONFIG[name].defaultJobOptions.removeOnFail).toEqual(expected);
		}
	});
});
