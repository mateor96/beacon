import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType, assertSameOrigin } from "@/lib/request-guards";
import { getScanAccess, normalizeAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { FixRequestSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

function hasId(value: unknown): value is { id: string } {
	return (
		typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
	);
}

export async function POST(request: Request) {
	try {
		const originReject = assertSameOrigin(request);
		if (originReject) return originReject;

		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
		}

		const parseResult = FixRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { scanId, checkId, accessToken: rawAccessToken } = parseResult.data;

		const rateLimitResult = await checkRateLimit(
			`fix:${hashIp(ip)}`,
			getRateLimitConfig("mutation", "anonymous"),
		);
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		const scan = await scanQueries.getById(db, scanId);
		if (!scan) {
			return NextResponse.json({ error: "Scan nicht gefunden." }, { status: 404 });
		}

		const accessToken = normalizeAccessToken(rawAccessToken);
		const accessMode = getScanAccess(scan, { viewerUserId: null, accessToken });
		if (accessMode !== "owner") {
			return NextResponse.json({ error: "Scan nicht gefunden." }, { status: 404 });
		}

		if (scan.status !== "completed") {
			return NextResponse.json({ error: "Der Scan wird noch verarbeitet." }, { status: 409 });
		}

		if (!scan.htmlContent) {
			return NextResponse.json({ error: "Der Scan enthält keinen HTML-Inhalt." }, { status: 409 });
		}

		const checks = Array.isArray(scan.checks) ? scan.checks : [];
		const check = checks.find((candidate) => hasId(candidate) && candidate.id === checkId);
		if (!check) {
			return NextResponse.json({ error: "Check nicht im Scan gefunden." }, { status: 404 });
		}

		const fixMap =
			scan.fixes && typeof scan.fixes === "object" && !Array.isArray(scan.fixes)
				? (scan.fixes as Record<
						string,
						{ checkId: string; content: string; filename: string; method: string }
					>)
				: {};
		const existingFix = fixMap[checkId] ?? null;
		if (existingFix) {
			return NextResponse.json({ scanId, checkId, status: "completed", fix: existingFix });
		}

		await addJob("fix", { scanId, checkIds: [checkId] }, { jobId: `fix:${scanId}:${checkId}` });

		await scanQueries.updateFixCheckStatus(db, scanId, checkId, {
			status: "pending",
			jobId: `fix:${scanId}:${checkId}`,
		});

		return NextResponse.json(
			{ scanId, checkId, status: "processing" },
			{ status: 202, headers: rateLimitHeaders(rateLimitResult) },
		);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
