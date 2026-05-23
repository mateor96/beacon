import { NextResponse } from "next/server";

/**
 * Defense-in-depth request guards for mutating API routes.
 *
 * CSRF protection model (3 layers):
 *   1. SameSite=Lax cookies (@supabase/ssr default) — blocks cross-site POST with session cookies
 *   2. Origin header validation (assertSameOrigin) — blocks cross-origin requests
 *   3. Content-Type: application/json (assertJsonContentType) — blocks form-based CSRF
 *
 * Session-bound routes (checkout, portal, analyze, fix, report): use assertSameOrigin + assertJsonContentType
 * Public JSON routes (scan, waitlist): use assertJsonContentType only
 * Webhook: excluded (Stripe signature verification is the trust boundary)
 */

/**
 * Resolve the canonical app origin from env or the request URL.
 * Exported for use in return URL construction (checkout, portal).
 */
export function getAppOrigin(request: Request): string {
	return new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin;
}

/**
 * Rejects requests whose Origin header does not match the app origin.
 *
 * Missing Origin → allowed (non-browser clients like curl/Postman, or same-origin
 * browser requests that omit Origin). Browsers always send Origin on cross-origin POST.
 * Malformed or mismatched Origin → rejected with 403.
 *
 * Returns null if the request passes, or a 403 NextResponse if rejected.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
	const origin = request.headers.get("origin");
	if (!origin) return null;

	try {
		if (new URL(origin).origin === getAppOrigin(request)) return null;
	} catch {
		// Malformed origin (including the string "null" from sandboxed iframes)
	}

	return NextResponse.json(
		{ error: "Anfrage wurde aus einer ungültigen Herkunft abgelehnt." },
		{ status: 403 },
	);
}

/**
 * Rejects requests without Content-Type: application/json.
 *
 * HTML forms cannot send application/json, so this check blocks form-based CSRF
 * even if Origin is somehow bypassed. Accepts charset parameters
 * (e.g., "application/json; charset=utf-8").
 *
 * Returns null if the request passes, or a 415 NextResponse if rejected.
 */
export function assertJsonContentType(request: Request): NextResponse | null {
	const ct = request.headers.get("content-type");
	if (ct && ct.split(";")[0].trim().toLowerCase() === "application/json") {
		return null;
	}

	return NextResponse.json({ error: "Content-Type muss application/json sein." }, { status: 415 });
}
