import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

vi.mock("@beacon/db", () => ({
	referralQueries: {
		getLinkByCode: vi.fn(),
	},
}));

const { referralQueries } = await import("@beacon/db");
const { generateUniqueReferralCode } = await import("../../referral/link-codes.js");

const fakeDb = {} as never;

describe("generateUniqueReferralCode", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a code on first attempt when no collision", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue(undefined);
		const code = await generateUniqueReferralCode(fakeDb);
		expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
		expect(code).not.toMatch(/[0O1Il]/);
		expect(referralQueries.getLinkByCode).toHaveBeenCalledTimes(1);
	});

	it("retries on collision and returns the eventual unique code", async () => {
		let calls = 0;
		vi.mocked(referralQueries.getLinkByCode).mockImplementation(async () => {
			calls++;
			return calls < 3 ? ({ id: "existing" } as never) : undefined;
		});
		const code = await generateUniqueReferralCode(fakeDb);
		expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
		expect(calls).toBe(3);
	});

	it("throws after max attempts exhausted", async () => {
		vi.mocked(referralQueries.getLinkByCode).mockResolvedValue({ id: "always" } as never);
		await expect(generateUniqueReferralCode(fakeDb, 2)).rejects.toThrow(/unique/);
	});
});
