import { describe, expect, it, vi } from "vitest";

// @beacon/db/client asserts DATABASE_URL at import-time. Satisfy it for the
// unit test so we can pull in the schema tables the resolver references.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

const { resolveBaselineUrl } = await import("../../guarantee/url-resolver.js");

// Minimal mock of the drizzle select-builder chain the resolver uses.
function mockDb(monitoring: Array<{ websiteUrl: string }>, scansRows: Array<{ url: string }>) {
	const monitoringChain = {
		from: () => monitoringChain,
		where: () => monitoringChain,
		orderBy: () => monitoringChain,
		limit: () => Promise.resolve(monitoring),
	};
	const scansChain = {
		from: () => scansChain,
		where: () => scansChain,
		orderBy: () => scansChain,
		limit: () => Promise.resolve(scansRows),
	};
	const select = vi
		.fn()
		.mockImplementationOnce(() => monitoringChain)
		.mockImplementationOnce(() => scansChain);
	return { select } as unknown as Parameters<typeof resolveBaselineUrl>[0];
}

describe("resolveBaselineUrl", () => {
	it("prefers metadata URL when present", async () => {
		const db = mockDb(
			[{ websiteUrl: "https://project.example" }],
			[{ url: "https://scan.example" }],
		);
		const url = await resolveBaselineUrl(db, "u1", "  https://meta.example  ");
		expect(url).toBe("https://meta.example");
	});

	it("falls back to latest monitoring project", async () => {
		const db = mockDb(
			[{ websiteUrl: "https://project.example" }],
			[{ url: "https://scan.example" }],
		);
		const url = await resolveBaselineUrl(db, "u1", null);
		expect(url).toBe("https://project.example");
	});

	it("falls back to most recent scan when no project", async () => {
		const db = mockDb([], [{ url: "https://scan.example" }]);
		const url = await resolveBaselineUrl(db, "u1", null);
		expect(url).toBe("https://scan.example");
	});

	it("returns null when nothing resolves", async () => {
		const db = mockDb([], []);
		const url = await resolveBaselineUrl(db, "u1", "");
		expect(url).toBeNull();
	});

	it("treats whitespace-only metadata as missing", async () => {
		const db = mockDb([], [{ url: "https://scan.example" }]);
		const url = await resolveBaselineUrl(db, "u1", "   ");
		expect(url).toBe("https://scan.example");
	});
});
