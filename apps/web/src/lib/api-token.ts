import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Instance-scoped bearer-token auth for the /api/v1/* public read API.
 *
 * The token is configured via the BEACON_API_TOKEN env var. There is no
 * per-user issuance in OSS mode — the operator who deploys the instance
 * mints one token (`openssl rand -hex 32`) and shares it with external
 * integrations (Looker Studio, n8n, custom scripts, etc.).
 *
 * Returns:
 *   - NextResponse with 503 if BEACON_API_TOKEN is unset (feature is off).
 *   - NextResponse with 401 if Authorization header is missing/malformed.
 *   - NextResponse with 401 if the bearer doesn't match (timing-safe).
 *   - null if auth passes; the route handler continues.
 */
export function assertBearerAuth(request: Request): NextResponse | null {
	const expected = process.env.BEACON_API_TOKEN;
	if (!expected) {
		return NextResponse.json(
			{
				error:
					"BEACON_API_TOKEN ist nicht konfiguriert. /api/v1/* ist deaktiviert; setze die env-Variable um es zu aktivieren.",
			},
			{ status: 503 },
		);
	}

	const header = request.headers.get("authorization");
	if (!header || !header.toLowerCase().startsWith("bearer ")) {
		return NextResponse.json(
			{ error: "Authorization: Bearer <BEACON_API_TOKEN> erforderlich." },
			{ status: 401 },
		);
	}

	const provided = header.slice(7).trim();
	if (provided.length !== expected.length) {
		return NextResponse.json({ error: "Ungültiges Token." }, { status: 401 });
	}
	const ok = timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
	if (!ok) {
		return NextResponse.json({ error: "Ungültiges Token." }, { status: 401 });
	}

	return null;
}
