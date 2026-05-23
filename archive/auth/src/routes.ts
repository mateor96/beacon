/**
 * Route contract for Beacon middleware.
 *
 * Security model: allow-by-default. Only PROTECTED_PREFIXES require auth.
 * AUTH_ROUTES redirect authenticated users away (to dashboard).
 * All other routes pass through with session refresh only.
 *
 * Rules:
 * 1. When adding a new page or API route, update this file in the same PR.
 * 2. AUTH_ROUTES = user-facing login/signup pages only (exact match).
 * 3. PROTECTED_PREFIXES = routes requiring authentication (prefix match).
 * 4. Auth infrastructure endpoints (/auth/callback, /auth/confirm) are in
 *    PUBLIC_ROUTES — they must always execute regardless of session state.
 * 5. /results/* and /api/scan/:id use handler-level access control (HMAC tokens
 *    or owner session). They are NOT classified as public — access is enforced
 *    in the route handlers, not middleware.
 *
 * Relationship to #114 (URL-Vertrag): This file governs auth/middleware route
 * classification. Issue #114 governs scanner URL semantics (inputUrl vs finalUrl
 * in CheckContext). The two contracts are independent — route classification
 * here does not affect how the scanner resolves redirects.
 */

/** Routes accessible without authentication. */
export const PUBLIC_ROUTES = [
	"/",
	"/pricing",
	"/billing/checkout/success",
	"/billing/checkout/cancel",
	"/impressum",
	"/datenschutz",
	"/agb",
	"/warteliste",
	"/api/health",
	"/api/scan",
	"/api/waitlist",
	"/api/billing/webhook",
	"/auth/callback",
	"/auth/confirm",
] as const;

/**
 * Auth UI pages. Authenticated users are redirected AWAY from these
 * to DEFAULT_LOGIN_REDIRECT. Only user-facing auth pages belong here —
 * NOT infrastructure endpoints like /auth/callback or /auth/confirm.
 */
export const AUTH_ROUTES = ["/login", "/signup"] as const;

/**
 * Route prefixes that require authentication.
 * Unauthenticated page requests → redirect to /login?next=...
 * Unauthenticated API requests → 401 JSON response.
 */
export const PROTECTED_PREFIXES = [
	"/dashboard",
	"/settings",
	"/admin",
	"/api/admin",
	"/api/billing",
	"/api/fix",
	"/api/report",
	"/api/analyze",
] as const;

export const DEFAULT_LOGIN_REDIRECT = "/dashboard";

export function isPublicRoute(pathname: string): boolean {
	if ((PUBLIC_ROUTES as readonly string[]).includes(pathname)) return true;
	if (pathname.startsWith("/api/waitlist")) return true;
	return false;
}

export function isAuthRoute(pathname: string): boolean {
	return (AUTH_ROUTES as readonly string[]).includes(pathname);
}

export function isProtectedRoute(pathname: string): boolean {
	if (pathname === "/api/billing/webhook") return false;
	return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isApiRoute(pathname: string): boolean {
	return pathname.startsWith("/api/");
}
