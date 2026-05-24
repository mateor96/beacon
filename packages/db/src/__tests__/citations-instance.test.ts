import { describe, expect, it } from "vitest";
import * as citations from "../queries/citations.js";

/**
 * Chainable query-builder mock: every method returns the proxy (so call chains
 * work), and awaiting it resolves to `rows`. Records calls for assertions.
 */
function makeChainable(rows: unknown[]) {
	const calls: Record<string, unknown[][]> = {};
	// biome-ignore lint/suspicious/noExplicitAny: builder proxy
	const proxy: any = new Proxy(
		{},
		{
			get(_t, prop: string) {
				if (prop === "then") {
					return (resolve: (v: unknown) => void) => resolve(rows);
				}
				return (...args: unknown[]) => {
					if (!calls[prop]) calls[prop] = [];
					calls[prop].push(args);
					return proxy;
				};
			},
		},
	);
	return { db: proxy, calls };
}

describe("listCitationsForInstance", () => {
	it("takes no userId and over-fetches by one for cursor pagination", async () => {
		const rows = [{ id: "c1" }, { id: "c2" }];
		const { db, calls } = makeChainable(rows);

		// Signature has no userId param — instance-wide by construction.
		// biome-ignore lint/suspicious/noExplicitAny: builder proxy
		const result = await citations.listCitationsForInstance(db as any, { limit: 5 });

		expect(result).toBe(rows);
		expect(calls.selectDistinct).toBeDefined();
		expect(calls.limit?.[0]).toEqual([6]);
	});

	it("joins cited pages when filtering by domain", async () => {
		const { db, calls } = makeChainable([]);
		// biome-ignore lint/suspicious/noExplicitAny: builder proxy
		await citations.listCitationsForInstance(db as any, { limit: 10, domain: "example.com" });
		expect(calls.innerJoin?.length).toBeGreaterThanOrEqual(2);
	});
});

describe("getCitationStatsForInstance", () => {
	it("returns the documented aggregate shape", async () => {
		const { db } = makeChainable([]);
		// biome-ignore lint/suspicious/noExplicitAny: builder proxy
		const stats = await citations.getCitationStatsForInstance(db as any);
		expect(stats).toEqual({
			total: 0,
			byModel: [],
			topPages: [],
			topDomains: [],
			trend: [],
		});
	});
});
