import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { createConfiguredProviders } from "@beacon/ai";
import { db, monitoringQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * Manually triggers an AI-visibility sweep for one project. Mirrors the daily
 * cron (`ai-visibility-sweep`): enqueues the primary brand keyword with the
 * same date-stamped jobId `ai-vis:<id>:<YYYY-MM-DD>`, so repeated clicks — and
 * a same-day cron run — dedupe to a single job (no double spend).
 */
export async function POST(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`sweep-trigger:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	if (createConfiguredProviders().length === 0) {
		return NextResponse.json(
			{ error: "Kein AI-Provider konfiguriert. Setze einen Provider-Key und starte neu." },
			{ status: 409, headers: rateLimitHeaders(rate) },
		);
	}

	const primary = project.brandKeywords[0];
	if (!primary) {
		return NextResponse.json(
			{ error: "Projekt hat kein Brand-Keyword." },
			{ status: 422, headers: rateLimitHeaders(rate) },
		);
	}

	const today = new Date().toISOString().slice(0, 10);
	const jobId = `ai-vis:${id}:${today}`;
	await addJob(
		"ai-visibility",
		{ projectId: id, brandName: primary, queryText: `Was ist ${primary}?` },
		{ jobId },
	);

	return NextResponse.json(
		{ enqueued: true, jobId },
		{ status: 202, headers: rateLimitHeaders(rate) },
	);
}
