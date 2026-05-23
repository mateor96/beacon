import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({ supabaseClient: true })),
}));

describe("createServiceClient", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
		process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

		const { createServiceClient } = await import("../service.js");
		expect(() => createServiceClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
	});

	it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = undefined;

		const { createServiceClient } = await import("../service.js");
		expect(() => createServiceClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY is required");
	});

	it("calls createClient with service role key and correct auth options", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

		const { createClient } = await import("@supabase/supabase-js");
		const { createServiceClient } = await import("../service.js");

		const client = createServiceClient();

		expect(createClient).toHaveBeenCalledWith("https://test.supabase.co", "test-service-key", {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
				detectSessionInUrl: false,
			},
		});
		expect(client).toEqual({ supabaseClient: true });
	});

	it("returns a new instance on each call (factory, not singleton)", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

		const { createClient } = await import("@supabase/supabase-js");
		const mockCreateClient = createClient as Mock;
		mockCreateClient.mockClear();
		mockCreateClient.mockReturnValueOnce({ id: 1 }).mockReturnValueOnce({ id: 2 });

		const { createServiceClient } = await import("../service.js");

		const client1 = createServiceClient();
		const client2 = createServiceClient();

		expect(client1).not.toBe(client2);
		expect(mockCreateClient).toHaveBeenCalledTimes(2);
	});
});
