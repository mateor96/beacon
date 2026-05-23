import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
	createBrowserClient: vi.fn(() => ({ supabaseClient: true })),
}));

describe("createAppBrowserClient", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

		const { createAppBrowserClient } = await import("../browser.js");
		expect(() => createAppBrowserClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
	});

	it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = undefined;

		const { createAppBrowserClient } = await import("../browser.js");
		expect(() => createAppBrowserClient()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
	});

	it("calls createBrowserClient with correct config", async () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

		const { createBrowserClient } = await import("@supabase/ssr");
		const { createAppBrowserClient } = await import("../browser.js");

		const client = createAppBrowserClient();

		expect(createBrowserClient).toHaveBeenCalledWith("https://test.supabase.co", "test-anon-key", {
			isSingleton: true,
		});
		expect(client).toEqual({ supabaseClient: true });
	});
});
