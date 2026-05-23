import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	competitiveQueries: {
		listHistoryForDomain: vi.fn().mockResolvedValue([]),
		appendScoreHistory: vi.fn(),
		pruneHistoryOlderThan: vi.fn(),
	},
}));

const { competitiveQueries } = await import("@beacon/db");
const { calculateTrend, trendThreshold, recordScore, pruneOldHistory } = await import(
	"../../competitive/trends.js"
);

describe("calculateTrend", () => {
	beforeEach(() => {
		process.env.COMPETITIVE_TREND_THRESHOLD = undefined;
	});

	it("returns stable for <2 points", () => {
		expect(calculateTrend([])).toBe("stable");
		expect(calculateTrend([50])).toBe("stable");
	});

	it("returns improving when last > first by >5%", () => {
		expect(calculateTrend([50, 55])).toBe("improving");
		expect(calculateTrend([50, 55.1])).toBe("improving");
	});

	it("returns declining when last < first by >5%", () => {
		expect(calculateTrend([50, 45])).toBe("declining");
	});

	it("returns stable when change within ±5%", () => {
		expect(calculateTrend([50, 51])).toBe("stable");
		expect(calculateTrend([50, 49])).toBe("stable");
		expect(calculateTrend([50, 50])).toBe("stable");
	});

	it("respects env threshold override", () => {
		process.env.COMPETITIVE_TREND_THRESHOLD = "0.15";
		expect(calculateTrend([50, 55])).toBe("stable"); // 10% doesn't exceed 15%
		expect(trendThreshold()).toBe(0.15);
	});

	it("handles zero baseline", () => {
		expect(calculateTrend([0, 10])).toBe("improving");
		expect(calculateTrend([0, 0])).toBe("stable");
	});
});

describe("recordScore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("computes trend from prior history + new score and writes history row", async () => {
		vi.mocked(competitiveQueries.listHistoryForDomain).mockResolvedValue([
			{ score: 70 },
			{ score: 68 },
			{ score: 65 },
		] as never);
		const res = await recordScore({} as never, {
			domainKey: "competitor:c1",
			score: 80,
			competitorId: "c1",
		});
		expect(res.trend).toBe("improving");
		expect(competitiveQueries.appendScoreHistory).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				domainKey: "competitor:c1",
				score: 80,
				trend: "improving",
				competitorId: "c1",
			}),
		);
	});

	it("trend is stable when no prior history", async () => {
		vi.mocked(competitiveQueries.listHistoryForDomain).mockResolvedValue([]);
		const res = await recordScore({} as never, { domainKey: "client:u1", score: 50 });
		expect(res.trend).toBe("stable");
	});
});

describe("pruneOldHistory", () => {
	it("calls prune with 52-week cutoff and returns deleted count", async () => {
		vi.mocked(competitiveQueries.pruneHistoryOlderThan).mockResolvedValue([
			{ id: "h1" },
			{ id: "h2" },
		] as never);
		const count = await pruneOldHistory({} as never);
		expect(count).toBe(2);
		const cutoffArg = vi.mocked(competitiveQueries.pruneHistoryOlderThan).mock.calls[0]?.[1];
		const diffDays = (Date.now() - (cutoffArg as Date).getTime()) / (24 * 60 * 60 * 1000);
		expect(Math.round(diffDays)).toBe(52 * 7);
	});
});
