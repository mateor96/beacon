import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	guaranteeQueries: {
		listDueForComparison: vi.fn().mockResolvedValue([]),
		getClaimById: vi.fn(),
		updateClaim: vi.fn(),
		createMilestone: vi.fn(),
	},
	scanQueries: {
		getById: vi.fn(),
		create: vi.fn(),
	},
	monitoringProjects: {},
	scans: {},
}));

vi.mock("@beacon/queue", () => ({
	addJob: vi.fn(),
}));

const { guaranteeQueries, scanQueries } = await import("@beacon/db");
const { addJob } = await import("@beacon/queue");
const { runDay90ComparisonCron, handleDay90ScanCompletion } = await import(
	"../../guarantee/day90.js"
);

const fakeTx = {} as never;

describe("day-90 comparison cron", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("skips claims with missing userId or baseline FK", async () => {
		vi.mocked(guaranteeQueries.listDueForComparison).mockResolvedValue([
			{ id: "c1", userId: null, baselineSnapshotId: "s1" } as never,
			{ id: "c2", userId: "u1", baselineSnapshotId: null } as never,
		]);
		const result = await runDay90ComparisonCron(fakeTx);
		expect(result).toEqual({ checked: 2, scheduled: 0, skipped: 2 });
		expect(scanQueries.create).not.toHaveBeenCalled();
		expect(addJob).not.toHaveBeenCalled();
	});

	it("skips claims whose baseline scan did not complete", async () => {
		vi.mocked(guaranteeQueries.listDueForComparison).mockResolvedValue([
			{ id: "c1", userId: "u1", baselineSnapshotId: "s1" } as never,
		]);
		vi.mocked(scanQueries.getById).mockResolvedValue({
			id: "s1",
			status: "pending",
			url: "https://x.test",
			score: 0,
		} as never);
		const result = await runDay90ComparisonCron(fakeTx);
		expect(result).toEqual({ checked: 1, scheduled: 0, skipped: 1 });
	});

	it("enqueues a scan per due claim with guarantee:day90:{claimId} jobId", async () => {
		vi.mocked(guaranteeQueries.listDueForComparison).mockResolvedValue([
			{ id: "claim_1", userId: "u1", baselineSnapshotId: "s1" } as never,
		]);
		vi.mocked(scanQueries.getById).mockResolvedValue({
			id: "s1",
			status: "completed",
			url: "https://site.test",
			score: 60,
		} as never);
		vi.mocked(scanQueries.create).mockResolvedValue({ id: "s_new" } as never);

		const result = await runDay90ComparisonCron(fakeTx);
		expect(result).toEqual({ checked: 1, scheduled: 1, skipped: 0 });
		expect(addJob).toHaveBeenCalledWith(
			"scan",
			{ scanId: "s_new", url: "https://site.test" },
			expect.objectContaining({ jobId: "guarantee:day90:claim_1", priority: 1 }),
		);
	});
});

describe("handleDay90ScanCompletion", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.GUARANTEE_COMPARISON_THRESHOLD = undefined;
	});

	it("returns null when claim is not active", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "refunded",
			baselineSnapshotId: "s1",
		} as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 80, "s_new");
		expect(res).toBeNull();
		expect(guaranteeQueries.updateClaim).not.toHaveBeenCalled();
	});

	it("marks claim as improved when delta exceeds threshold (default 0)", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: "s1",
		} as never);
		vi.mocked(scanQueries.getById).mockResolvedValue({
			id: "s1",
			score: 50,
		} as never);

		const res = await handleDay90ScanCompletion(fakeTx, "c1", 75, "s_new");
		expect(res).toEqual({ decision: "improved", delta: 25 });
		expect(guaranteeQueries.updateClaim).toHaveBeenCalledWith(fakeTx, "c1", {
			status: "improved",
		});
		expect(guaranteeQueries.createMilestone).toHaveBeenCalledWith(
			fakeTx,
			expect.objectContaining({
				claimId: "c1",
				milestoneDay: 90,
				delta: 25,
				baselineScore: 50,
				currentScore: 75,
			}),
		);
	});

	it("marks claim eligible_for_refund when delta <= threshold", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: "s1",
		} as never);
		vi.mocked(scanQueries.getById).mockResolvedValue({ id: "s1", score: 70 } as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 70, "s_new");
		expect(res).toEqual({ decision: "eligible_for_refund", delta: 0 });
	});

	it("respects GUARANTEE_COMPARISON_THRESHOLD env var", async () => {
		process.env.GUARANTEE_COMPARISON_THRESHOLD = "5";
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: "s1",
		} as never);
		vi.mocked(scanQueries.getById).mockResolvedValue({ id: "s1", score: 60 } as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 63, "s_new");
		// delta=3 which is <= 5 → not improved
		expect(res?.decision).toBe("eligible_for_refund");
	});

	// #296 additions — score-comparison edge cases

	it("treats a NEGATIVE delta (score got worse) as eligible_for_refund", async () => {
		process.env.GUARANTEE_COMPARISON_THRESHOLD = undefined;
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: "s1",
		} as never);
		vi.mocked(scanQueries.getById).mockResolvedValue({ id: "s1", score: 80 } as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 50, "s_new");
		expect(res?.decision).toBe("eligible_for_refund");
		expect(res?.delta).toBe(-30);
	});

	it("treats delta of exactly +1 as improved (default threshold = 0)", async () => {
		process.env.GUARANTEE_COMPARISON_THRESHOLD = undefined;
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: "s1",
		} as never);
		vi.mocked(scanQueries.getById).mockResolvedValue({ id: "s1", score: 70 } as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 71, "s_new");
		expect(res?.decision).toBe("improved");
		expect(res?.delta).toBe(1);
	});

	it("returns null when the claim's baseline snapshot is missing", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "active",
			baselineSnapshotId: null,
		} as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 80, "s_new");
		expect(res).toBeNull();
		expect(guaranteeQueries.updateClaim).not.toHaveBeenCalled();
	});

	it("returns null for cancelled claims (terminal state, no transition)", async () => {
		vi.mocked(guaranteeQueries.getClaimById).mockResolvedValue({
			id: "c1",
			status: "cancelled",
			baselineSnapshotId: "s1",
		} as never);
		const res = await handleDay90ScanCompletion(fakeTx, "c1", 99, "s_new");
		expect(res).toBeNull();
		expect(guaranteeQueries.updateClaim).not.toHaveBeenCalled();
	});
});
