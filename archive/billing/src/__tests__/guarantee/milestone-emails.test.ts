import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	guaranteeQueries: {
		listClaimsSince: vi.fn().mockResolvedValue([]),
		getMilestonesByClaim: vi.fn().mockResolvedValue([]),
		createMilestone: vi.fn(),
		markMilestoneNotified: vi.fn(),
	},
	profileQueries: {
		getById: vi.fn(),
	},
	scans: {},
	monitoringProjects: {},
}));

vi.mock("@beacon/queue", () => ({
	addJob: vi.fn(),
}));

vi.mock("@beacon/notifications", () => ({
	templates: {
		"guarantee-milestone": vi.fn().mockReturnValue({
			subject: "subject",
			html: "<p>html</p>",
			text: "text",
		}),
	},
}));

const { guaranteeQueries, profileQueries } = await import("@beacon/db");
const { addJob } = await import("@beacon/queue");
const { runMilestoneEmailsCron } = await import("../../guarantee/milestone-emails.js");

const fakeTx = {
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				orderBy: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([{ score: 75 }]),
				}),
				limit: vi.fn().mockResolvedValue([{ score: 60 }]),
			}),
		}),
	}),
} as never;

describe("runMilestoneEmailsCron", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("skips claims younger than 30 days", async () => {
		vi.mocked(guaranteeQueries.listClaimsSince).mockResolvedValue([
			{
				id: "c1",
				userId: "u1",
				startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
				baselineSnapshotId: "s1",
				status: "active",
			} as never,
		]);
		const result = await runMilestoneEmailsCron(fakeTx);
		expect(result).toEqual({ processed: 1, enqueued: 0, skipped: 1 });
		expect(addJob).not.toHaveBeenCalled();
	});

	it("skips when milestone already notified", async () => {
		vi.mocked(guaranteeQueries.listClaimsSince).mockResolvedValue([
			{
				id: "c1",
				userId: "u1",
				startedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
				baselineSnapshotId: "s1",
				status: "active",
			} as never,
		]);
		vi.mocked(guaranteeQueries.getMilestonesByClaim).mockResolvedValue([
			{ id: "m1", milestoneDay: 30, notifiedAt: new Date() } as never,
		]);
		const result = await runMilestoneEmailsCron(fakeTx);
		expect(result.enqueued).toBe(0);
		expect(result.skipped).toBe(1);
	});

	it("enqueues a day-30 interim email when due", async () => {
		vi.mocked(guaranteeQueries.listClaimsSince).mockResolvedValue([
			{
				id: "c1",
				userId: "u1",
				startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
				baselineSnapshotId: "s1",
				status: "active",
			} as never,
		]);
		vi.mocked(guaranteeQueries.getMilestonesByClaim).mockResolvedValue([]);
		vi.mocked(guaranteeQueries.createMilestone).mockResolvedValue({ id: "m1" } as never);
		vi.mocked(profileQueries.getById).mockResolvedValue({
			id: "u1",
			email: "user@test.de",
		} as never);

		const result = await runMilestoneEmailsCron(fakeTx);
		expect(result.enqueued).toBe(1);
		expect(addJob).toHaveBeenCalledWith(
			"email",
			expect.objectContaining({
				to: ["user@test.de"],
				emailLogId: "guarantee-milestone-c1-30",
			}),
		);
		expect(guaranteeQueries.markMilestoneNotified).toHaveBeenCalledWith(
			fakeTx,
			"m1",
			expect.any(Date),
		);
	});

	it("sends improved variant on day-90 when claim status is improved", async () => {
		vi.mocked(guaranteeQueries.listClaimsSince).mockResolvedValue([
			{
				id: "c1",
				userId: "u1",
				startedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
				baselineSnapshotId: "s1",
				status: "improved",
			} as never,
		]);
		// Day-90 worker already wrote the milestone with comparison scan
		vi.mocked(guaranteeQueries.getMilestonesByClaim).mockResolvedValue([
			{
				id: "m1",
				milestoneDay: 90,
				notifiedAt: null,
				currentScore: 80,
				baselineScore: 60,
			} as never,
		]);
		vi.mocked(profileQueries.getById).mockResolvedValue({
			id: "u1",
			email: "user@test.de",
		} as never);

		const { templates } = await import("@beacon/notifications");
		const result = await runMilestoneEmailsCron(fakeTx);
		expect(result.enqueued).toBe(1);
		expect(templates["guarantee-milestone"]).toHaveBeenCalledWith(
			expect.objectContaining({ milestoneDay: 90, variant: "improved" }),
			"",
		);
	});

	it("skips interim email if user has no completed scans", async () => {
		vi.mocked(guaranteeQueries.listClaimsSince).mockResolvedValue([
			{
				id: "c1",
				userId: "u1",
				startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
				baselineSnapshotId: "s1",
				status: "active",
			} as never,
		]);
		vi.mocked(guaranteeQueries.getMilestonesByClaim).mockResolvedValue([]);
		// Mock all scores as 0 → no completed score
		const emptyTx = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ score: 0 }]),
						}),
						limit: vi.fn().mockResolvedValue([{ score: 60 }]),
					}),
				}),
			}),
		} as never;

		const result = await runMilestoneEmailsCron(emptyTx);
		expect(result.enqueued).toBe(0);
		expect(result.skipped).toBe(1);
	});
});
