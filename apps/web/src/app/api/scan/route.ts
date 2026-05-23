import { NextResponse } from "next/server";

import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { mintAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { assertSafeUrl } from "@beacon/scanner";
import { ScanRequestSchema } from "@beacon/shared";

const ANON_SCAN_RETENTION_DAYS = 30;

/**
 * Open-source Beacon has no plan tiers, no per-user quota, and no auth gating.
 * The only protection on /api/scan is per-IP rate limiting (anti-abuse).
 * Every visitor gets a signed access token tied to the scan id so results
 * are still scoped to the requester.
 */
export async function POST(request: Request) {
	try {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
		}

		const parseResult = ScanRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { url } = parseResult.data;

		try {
			assertSafeUrl(url);
		} catch {
			return NextResponse.json({ error: "Diese URL kann nicht gescannt werden." }, { status: 400 });
		}

		const rateLimitResult = await checkRateLimit(
			`scan:${hashIp(ip)}`,
			getRateLimitConfig("scan", "anonymous"),
		);
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		if (!process.env.SCAN_ACCESS_SECRET) {
			return NextResponse.json(
				{ error: "SCAN_ACCESS_SECRET ist nicht konfiguriert." },
				{ status: 500 },
			);
		}

		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + ANON_SCAN_RETENTION_DAYS);

		const createdScan = await db.transaction(async (tx) => {
			const scan = await scanQueries.create(tx, {
				userId: null,
				url,
				score: 0,
				readinessLevel: 0,
				levelScores: {
					readability: null,
					interactivity: null,
					transactional: null,
				},
				checks: [],
				status: "pending",
				expiresAt,
			});

			await addJob("scan", { scanId: scan.id, url }, { jobId: scan.id });
			return scan;
		});

		const accessToken = mintAccessToken(createdScan.id, expiresAt);
		const resultsUrl = `/results/${createdScan.id}?access=${accessToken}`;

		return NextResponse.json(
			{ scanId: createdScan.id, status: "pending", resultsUrl },
			{ status: 202, headers: rateLimitHeaders(rateLimitResult) },
		);
	} catch (error: unknown) {
		console.error("[POST /api/scan] Unhandled error:", error);
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
