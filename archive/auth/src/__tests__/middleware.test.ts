import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig } from "../config.js";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
	createServerClient: vi.fn(),
}));

// Mock next/server
vi.mock("next/server", () => {
	const NextResponse = {
		next: vi.fn(({ request }: { request: unknown }) => ({
			request,
			cookies: {
				set: vi.fn(),
			},
		})),
		redirect: vi.fn((url: URL) => ({
			type: "redirect",
			url: url.toString(),
		})),
		json: vi.fn((body: unknown, init: { status: number }) => ({
			type: "json",
			body,
			status: init.status,
		})),
	};
	return { NextResponse };
});

describe("getSupabaseConfig", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
	});

	it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = undefined;
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = undefined;
		expect(() => getSupabaseConfig()).toThrow("NEXT_PUBLIC_SUPABASE_URL is required");
	});

	it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = undefined;
		expect(() => getSupabaseConfig()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
	});

	it("returns config when both env vars are set", () => {
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
		const config = getSupabaseConfig();
		expect(config.url).toBe("https://test.supabase.co");
		expect(config.anonKey).toBe("test-anon-key");
	});
});

describe("updateSession", () => {
	let createServerClient: Mock;

	beforeEach(async () => {
		vi.resetModules();
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

		const ssrModule = await import("@supabase/ssr");
		createServerClient = ssrModule.createServerClient as Mock;
	});

	function createMockRequest(pathname: string) {
		const url = new URL(pathname, "http://localhost:3000");
		return {
			cookies: {
				getAll: vi.fn(() => []),
				set: vi.fn(),
			},
			nextUrl: {
				pathname,
				clone: () => new URL(url),
				searchParams: url.searchParams,
			},
			url: "http://localhost:3000",
		};
	}

	function setupMockUser(user: { id: string } | null) {
		createServerClient.mockReturnValue({
			auth: {
				getUser: vi.fn().mockResolvedValue({
					data: { user },
				}),
			},
		});
	}

	it("redirects unauthenticated user on protected page route to /login", async () => {
		setupMockUser(null);
		const request = createMockRequest("/dashboard");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "redirect");
		expect((response as { url: string }).url).toContain("/login");
		expect((response as { url: string }).url).toContain("next=%2Fdashboard");
	});

	it("returns 401 JSON for unauthenticated user on protected API route", async () => {
		setupMockUser(null);
		const request = createMockRequest("/api/fix/something");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "json");
		expect(response).toHaveProperty("status", 401);
		expect((response as { body: { error: string } }).body.error).toBe("Nicht authentifiziert");
	});

	it("passes through unauthenticated user on public route", async () => {
		setupMockUser(null);
		const request = createMockRequest("/");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).not.toHaveProperty("type", "redirect");
		expect(response).not.toHaveProperty("type", "json");
	});

	it("redirects authenticated user on /login to /dashboard", async () => {
		setupMockUser({ id: "user-123" });
		const request = createMockRequest("/login");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "redirect");
		expect((response as { url: string }).url).toContain("/dashboard");
	});

	it("passes through authenticated user on /auth/callback (not redirected)", async () => {
		setupMockUser({ id: "user-123" });
		const request = createMockRequest("/auth/callback");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).not.toHaveProperty("type", "redirect");
		expect(response).not.toHaveProperty("type", "json");
	});

	it("passes through unauthenticated user on /auth/confirm", async () => {
		setupMockUser(null);
		const request = createMockRequest("/auth/confirm");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).not.toHaveProperty("type", "redirect");
		expect(response).not.toHaveProperty("type", "json");
	});

	it("passes through unauthenticated user on /api/scan (public API)", async () => {
		setupMockUser(null);
		const request = createMockRequest("/api/scan");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).not.toHaveProperty("type", "redirect");
		expect(response).not.toHaveProperty("type", "json");
	});

	it("returns 401 for unauthenticated user on /api/report (protected API)", async () => {
		setupMockUser(null);
		const request = createMockRequest("/api/report");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "json");
		expect(response).toHaveProperty("status", 401);
	});

	it("returns 401 for unauthenticated user on /api/analyze (protected API)", async () => {
		setupMockUser(null);
		const request = createMockRequest("/api/analyze");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "json");
		expect(response).toHaveProperty("status", 401);
	});

	it("redirects unauthenticated user on /settings to /login", async () => {
		setupMockUser(null);
		const request = createMockRequest("/settings");

		const { updateSession } = await import("../middleware.js");
		const response = await updateSession(request as never);

		expect(response).toHaveProperty("type", "redirect");
		expect((response as { url: string }).url).toContain("/login");
	});
});
