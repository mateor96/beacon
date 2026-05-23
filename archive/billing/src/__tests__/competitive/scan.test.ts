import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	competitorQueries: { getById: vi.fn() },
	competitiveQueries: { createScanResult: vi.fn() },
	scanQueries: { create: vi.fn() },
}));
vi.mock("@beacon/queue", () => ({ addJob: vi.fn() }));

const { competitorQueries, competitiveQueries, scanQueries } = await import("@beacon/db");
const { addJob } = await import("@beacon/queue");
const { enqueueCompetitorScan, competitorScanJobId } = await import("../../competitive/scan.js");

const fakeDb = {} as never;

describe("enqueueCompetitorScan", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns competitor_not_found when id unknown", async () => {
		vi.mocked(competitorQueries.getById).mockResolvedValue(undefined);
		expect(
			await enqueueCompetitorScan({ db: fakeDb, competitorId: "c1", url: "", userId: null }),
		).toEqual({
			status: "competitor_not_found",
		});
	});

	it("returns no_domain when competitor has empty domain and no url", async () => {
		vi.mocked(competitorQueries.getById).mockResolvedValue({
			id: "c1",
			domain: null,
		} as never);
		expect(
			await enqueueCompetitorScan({ db: fakeDb, competitorId: "c1", url: "", userId: null }),
		).toEqual({
			status: "no_domain",
		});
	});

	it("enqueues a scan job with competitor-scoped jobId", async () => {
		vi.mocked(competitorQueries.getById).mockResolvedValue({
			id: "c1",
			domain: "example.de",
		} as never);
		vi.mocked(scanQueries.create).mockResolvedValue({ id: "scan_1" } as never);
		vi.mocked(competitiveQueries.createScanResult).mockResolvedValue({ id: "result_1" } as never);

		const res = await enqueueCompetitorScan({
			db: fakeDb,
			competitorId: "c1",
			url: "",
			userId: "u1",
		});
		expect(res).toEqual({ status: "enqueued", scanId: "scan_1", resultId: "result_1" });
		expect(addJob).toHaveBeenCalledWith(
			"scan",
			{ scanId: "scan_1", url: "https://example.de" },
			expect.objectContaining({ jobId: "competitor:scan:c1", priority: 5 }),
		);
	});

	it("competitorScanJobId prefix lookup", () => {
		expect(competitorScanJobId("abc")).toBe("competitor:scan:abc");
	});
});
