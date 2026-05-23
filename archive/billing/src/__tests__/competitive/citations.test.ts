import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	competitorQueries: { getByProjectId: vi.fn() },
	competitiveQueries: { listCompletedScansForCompetitors: vi.fn() },
}));

const { competitorQueries, competitiveQueries } = await import("@beacon/db");
const { getCitationShareForProject } = await import("../../competitive/citations.js");

const fakeDb = {} as never;

describe("getCitationShareForProject", () => {
	beforeEach(() => vi.clearAllMocks());

	it("returns only client row when no competitors", async () => {
		vi.mocked(competitorQueries.getByProjectId).mockResolvedValue([]);
		vi.mocked(competitiveQueries.listCompletedScansForCompetitors).mockResolvedValue([]);
		const rows = await getCitationShareForProject(fakeDb, {
			projectId: "p1",
			clientCitationCount: 50,
			clientDomain: "example.com",
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			isClient: true,
			citationCount: 50,
			sharePercent: 100,
		});
	});

	it("computes share across client + 2 competitors", async () => {
		vi.mocked(competitorQueries.getByProjectId).mockResolvedValue([
			{ id: "c1", name: "A", domain: "a.de" },
			{ id: "c2", name: "B", domain: "b.de" },
		] as never);
		// listCompletedScansForCompetitors returns newest first — we want
		// the first-seen per competitor to win.
		vi.mocked(competitiveQueries.listCompletedScansForCompetitors).mockResolvedValue([
			{ competitorId: "c1", citationCount: 30 },
			{ competitorId: "c1", citationCount: 10 }, // older, should be ignored
			{ competitorId: "c2", citationCount: 20 },
		] as never);

		const rows = await getCitationShareForProject(fakeDb, {
			projectId: "p1",
			clientCitationCount: 50,
			clientDomain: "example.com",
		});

		// total = 50 + 30 + 20 = 100
		expect(rows[0]).toMatchObject({ isClient: true, citationCount: 50, sharePercent: 50 });
		expect(rows[1]).toMatchObject({ competitorId: "c1", citationCount: 30, sharePercent: 30 });
		expect(rows[2]).toMatchObject({ competitorId: "c2", citationCount: 20, sharePercent: 20 });
	});

	it("returns zero share when all counts are zero", async () => {
		vi.mocked(competitorQueries.getByProjectId).mockResolvedValue([
			{ id: "c1", name: "A", domain: "a.de" },
		] as never);
		vi.mocked(competitiveQueries.listCompletedScansForCompetitors).mockResolvedValue([]);
		const rows = await getCitationShareForProject(fakeDb, {
			projectId: "p1",
			clientCitationCount: 0,
			clientDomain: "x.com",
		});
		expect(rows.every((r) => r.sharePercent === 0)).toBe(true);
	});
});
