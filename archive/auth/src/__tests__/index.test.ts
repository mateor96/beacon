import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
	createServerClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn(),
}));

import {
	AUTH_ROUTES,
	AUTH_VERSION,
	PROTECTED_PREFIXES,
	PUBLIC_ROUTES,
	createAppServerClient,
	createServiceClient,
	getSupabaseServiceConfig,
	isApiRoute,
	isAuthRoute,
	isProtectedRoute,
	isPublicRoute,
} from "../index.js";

describe("@beacon/auth", () => {
	it("exports AUTH_VERSION", () => {
		expect(AUTH_VERSION).toBe("0.2.0");
		expect(typeof AUTH_VERSION).toBe("string");
	});

	it("exports createAppServerClient", () => {
		expect(typeof createAppServerClient).toBe("function");
	});

	it("exports createServiceClient", () => {
		expect(typeof createServiceClient).toBe("function");
	});

	it("exports getSupabaseServiceConfig", () => {
		expect(typeof getSupabaseServiceConfig).toBe("function");
	});
});

describe("route classification", () => {
	describe("isPublicRoute", () => {
		it("returns true for exact public routes", () => {
			expect(isPublicRoute("/")).toBe(true);
			expect(isPublicRoute("/pricing")).toBe(true);
			expect(isPublicRoute("/billing/checkout/success")).toBe(true);
			expect(isPublicRoute("/billing/checkout/cancel")).toBe(true);
			expect(isPublicRoute("/impressum")).toBe(true);
			expect(isPublicRoute("/datenschutz")).toBe(true);
			expect(isPublicRoute("/agb")).toBe(true);
			expect(isPublicRoute("/warteliste")).toBe(true);
			expect(isPublicRoute("/api/health")).toBe(true);
			expect(isPublicRoute("/api/scan")).toBe(true);
			expect(isPublicRoute("/api/waitlist")).toBe(true);
			expect(isPublicRoute("/auth/callback")).toBe(true);
			expect(isPublicRoute("/auth/confirm")).toBe(true);
		});

		it("returns true for /api/waitlist/* prefix", () => {
			expect(isPublicRoute("/api/waitlist/confirm")).toBe(true);
		});

		it("returns false for /results/* (handler-level access control)", () => {
			expect(isPublicRoute("/results/abc-123")).toBe(false);
		});

		it("returns false for /api/scan/:id (handler-level access control)", () => {
			expect(isPublicRoute("/api/scan/550e8400-e29b-41d4-a716-446655440000")).toBe(false);
			expect(isPublicRoute("/api/scan/any-id")).toBe(false);
		});

		it("returns false for non-public routes", () => {
			expect(isPublicRoute("/dashboard")).toBe(false);
			expect(isPublicRoute("/login")).toBe(false);
			expect(isPublicRoute("/settings")).toBe(false);
		});
	});

	describe("isAuthRoute", () => {
		it("returns true for auth UI pages", () => {
			expect(isAuthRoute("/login")).toBe(true);
			expect(isAuthRoute("/signup")).toBe(true);
		});

		it("returns false for auth infrastructure endpoints", () => {
			expect(isAuthRoute("/auth/callback")).toBe(false);
			expect(isAuthRoute("/auth/confirm")).toBe(false);
		});

		it("returns false for non-auth routes", () => {
			expect(isAuthRoute("/dashboard")).toBe(false);
			expect(isAuthRoute("/")).toBe(false);
			expect(isAuthRoute("/api/scan")).toBe(false);
		});
	});

	describe("isProtectedRoute", () => {
		it("returns true for protected prefixes", () => {
			expect(isProtectedRoute("/dashboard")).toBe(true);
			expect(isProtectedRoute("/dashboard/sites")).toBe(true);
			expect(isProtectedRoute("/settings")).toBe(true);
			expect(isProtectedRoute("/settings/billing")).toBe(true);
			expect(isProtectedRoute("/api/billing")).toBe(true);
			expect(isProtectedRoute("/api/billing/checkout")).toBe(true);
			expect(isProtectedRoute("/api/fix")).toBe(true);
			expect(isProtectedRoute("/api/fix/scan-id")).toBe(true);
			expect(isProtectedRoute("/api/report")).toBe(true);
			expect(isProtectedRoute("/api/analyze")).toBe(true);
		});

		it("returns false for non-protected routes", () => {
			expect(isProtectedRoute("/")).toBe(false);
			expect(isProtectedRoute("/pricing")).toBe(false);
			expect(isProtectedRoute("/api/scan")).toBe(false);
			expect(isProtectedRoute("/login")).toBe(false);
		});
	});

	describe("isApiRoute", () => {
		it("returns true for API routes", () => {
			expect(isApiRoute("/api/health")).toBe(true);
			expect(isApiRoute("/api/scan")).toBe(true);
			expect(isApiRoute("/api/fix")).toBe(true);
		});

		it("returns false for non-API routes", () => {
			expect(isApiRoute("/dashboard")).toBe(false);
			expect(isApiRoute("/")).toBe(false);
		});
	});

	describe("exhaustiveness guard", () => {
		it("every PUBLIC_ROUTES entry is recognized by isPublicRoute", () => {
			for (const route of PUBLIC_ROUTES) {
				expect(isPublicRoute(route)).toBe(true);
			}
		});

		it("every AUTH_ROUTES entry is recognized by isAuthRoute", () => {
			for (const route of AUTH_ROUTES) {
				expect(isAuthRoute(route)).toBe(true);
			}
		});

		it("every PROTECTED_PREFIXES entry is recognized by isProtectedRoute", () => {
			for (const prefix of PROTECTED_PREFIXES) {
				expect(isProtectedRoute(prefix)).toBe(true);
			}
		});

		it("no overlap between public and protected routes", () => {
			for (const route of PUBLIC_ROUTES) {
				expect(isProtectedRoute(route)).toBe(false);
			}
		});

		it("no overlap between public and auth routes", () => {
			for (const route of PUBLIC_ROUTES) {
				expect(isAuthRoute(route)).toBe(false);
			}
		});

		it("no overlap between auth and protected routes", () => {
			for (const route of AUTH_ROUTES) {
				expect(isProtectedRoute(route)).toBe(false);
			}
		});
	});
});
