import { describe, expect, it, vi } from "vitest";

// Mock the ensureProfile function behavior (no real DB)
describe("ensureProfile", () => {
	it("inserts a new profile and returns it", async () => {
		const mockProfile = { id: "user-1", email: "test@example.com", plan: "free" };
		const mockDb = {
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					onConflictDoUpdate: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockProfile]),
					}),
				}),
			}),
		};

		const { ensureProfile } = await import("../queries/profiles");
		const result = await ensureProfile(mockDb as never, {
			id: "user-1",
			email: "test@example.com",
		});
		expect(result).toEqual(mockProfile);
	});

	it("updates email on conflict and returns profile", async () => {
		const mockProfile = { id: "user-1", email: "new@example.com", plan: "starter" };
		const mockDb = {
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					onConflictDoUpdate: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([mockProfile]),
					}),
				}),
			}),
		};

		const { ensureProfile } = await import("../queries/profiles");
		const result = await ensureProfile(mockDb as never, { id: "user-1", email: "new@example.com" });
		expect(result.email).toBe("new@example.com");
	});

	it("throws when no row returned", async () => {
		const mockDb = {
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					onConflictDoUpdate: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
		};

		const { ensureProfile } = await import("../queries/profiles");
		await expect(
			ensureProfile(mockDb as never, { id: "user-1", email: "test@example.com" }),
		).rejects.toThrow("did not return a row");
	});
});
