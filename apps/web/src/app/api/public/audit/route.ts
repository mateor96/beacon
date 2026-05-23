import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { addJob } from "@beacon/queue";

export async function POST(request: Request) {
	try {
		// 1. Extract IP
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		// 2. Content-Type guard
		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		// 3. Per-minute rate limit
		const rateLimitResult = await checkRateLimit(
			`public-audit:${hashIp(ip)}`,
			getRateLimitConfig("public", "anonymous"),
		);
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		// 3b. 24h daily limit
		const dailyResult = await checkRateLimit(`public-audit-daily:${hashIp(ip)}`, {
			maxRequests: 3,
			windowMs: 24 * 60 * 60 * 1000,
		});
		if (!dailyResult.allowed) {
			return createRateLimitResponse(
				dailyResult,
				"Sie haben das Tageslimit von 3 kostenlosen Audits erreicht. Erstellen Sie ein Konto für unbegrenzte Scans.",
			);
		}

		// 4. Parse JSON body
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
		}

		// 4b. Honeypot check
		if (
			body &&
			typeof body === "object" &&
			"website_url_confirm" in body &&
			(body as Record<string, unknown>).website_url_confirm
		) {
			return NextResponse.json({ jobId: crypto.randomUUID(), status: "pending" }, { status: 202 });
		}

		// 4c. Extract fingerprint
		const fingerprint =
			typeof (body as Record<string, unknown>).fingerprint === "string"
				? ((body as Record<string, unknown>).fingerprint as string)
				: undefined;

		// 5. Validate with ScanRequestSchema
		const { ScanRequestSchema } = await import("@beacon/shared");
		const parseResult = ScanRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { url } = parseResult.data;

		// 5b. Fingerprint rate limit
		if (fingerprint && fingerprint.length >= 16) {
			const fpResult = await checkRateLimit(`public-audit-fp:${fingerprint}`, {
				maxRequests: 3,
				windowMs: 24 * 60 * 60 * 1000,
			});
			if (!fpResult.allowed) {
				return createRateLimitResponse(fpResult);
			}
		}

		// 5c. CAPTCHA verification (conditional on daily remaining)
		const captchaToken =
			typeof (body as Record<string, unknown>).captchaToken === "string"
				? ((body as Record<string, unknown>).captchaToken as string)
				: undefined;

		if (dailyResult.remaining < 2 && captchaToken) {
			const { verifyCaptcha } = await import("@/lib/captcha");
			const captchaOk = await verifyCaptcha(captchaToken, ip);
			if (!captchaOk) {
				return NextResponse.json(
					{ error: "CAPTCHA-Verifizierung fehlgeschlagen. Bitte erneut versuchen." },
					{ status: 400 },
				);
			}
		}

		// 6. SSRF check
		try {
			const { assertSafeUrl } = await import("@beacon/scanner");
			assertSafeUrl(url);
		} catch {
			return NextResponse.json({ error: "Diese URL kann nicht gescannt werden." }, { status: 400 });
		}

		// 7. Insert DB row + enqueue job
		const { db, publicAuditQueries } = await import("@beacon/db");
		const row = await publicAuditQueries.createRequest(db, {
			ipHash: hashIp(ip),
			url,
			status: "pending",
			fingerprint: fingerprint ?? null,
		});

		if (!row) {
			return NextResponse.json(
				{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
				{ status: 500 },
			);
		}

		await addJob("public-audit", { requestId: row.id, url }, { jobId: row.id });

		return NextResponse.json(
			{ jobId: row.id, status: "pending" },
			{ status: 202, headers: rateLimitHeaders(dailyResult) },
		);
	} catch (error) {
		console.error("[POST /api/public/audit] Unhandled error:", error);
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
