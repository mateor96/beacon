import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";

const RATE_LIMIT_CONFIG = {
	maxRequests: 5,
	windowMs: 15 * 60 * 1000, // 15 minutes
};

export async function POST(request: Request) {
	try {
		// Rate limit by IP
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
		const rateLimitResult = await checkRateLimit(`waitlist:${ip}`, RATE_LIMIT_CONFIG);

		if (!rateLimitResult.allowed) {
			return NextResponse.json(
				{ error: "Zu viele Anfragen. Bitte versuche es später erneut." },
				{
					status: 429,
					headers: {
						"Retry-After": String(
							Math.max(1, Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
						),
					},
				},
			);
		}

		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		const body = await request.json();

		// Honeypot check
		if (body.website_url_confirm) {
			// Silently reject bot submissions
			return NextResponse.json({ ok: true });
		}

		// Validate with Zod
		const { WaitlistSignupSchema } = await import("@beacon/shared");
		const result = WaitlistSignupSchema.safeParse(body);
		if (!result.success) {
			const firstError = result.error.issues[0]?.message ?? "Ungültige Daten";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}

		const { email, companyName, websiteUrl, source } = result.data;

		// Generate confirmation token
		const confirmToken = crypto.randomUUID();

		// Save to database
		const { db, waitlistQueries } = await import("@beacon/db");
		await waitlistQueries.create(db, {
			email,
			companyName: companyName ?? null,
			websiteUrl: websiteUrl ?? null,
			confirmToken,
			source: source ?? "landing",
		});

		// TODO: Send confirmation email (Phase 2 — @beacon/notifications)
		// For now, auto-confirm in development
		if (process.env.NODE_ENV === "development") {
			const signup = await waitlistQueries.getByEmail(db, email);
			if (signup) {
				await waitlistQueries.confirm(db, signup.id);
			}
		}

		return NextResponse.json({ ok: true });
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut." },
			{ status: 500 },
		);
	}
}
