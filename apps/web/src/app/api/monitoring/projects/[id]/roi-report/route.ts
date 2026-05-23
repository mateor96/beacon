import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { db, monitoringQueries, roiQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`roi-trigger:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	await addJob(
		"roi-report",
		{ projectId: id, format: "pdf" },
		{ jobId: `roi:${id}:${Date.now()}` },
	);

	return NextResponse.json(
		{
			projectId: id,
			status: "queued",
			message:
				"ROI-Report wurde in die Warteschlange gestellt. Verfügbare Reports siehe GET /api/monitoring/projects/[id]/roi-report",
		},
		{ status: 202, headers: rateLimitHeaders(rate) },
	);
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const reports = await roiQueries.getReportsForProject(db, id);
	return NextResponse.json({
		reports: reports.map((r) => ({
			id: r.id,
			createdAt: r.createdAt.toISOString(),
			format: r.format,
			// reportData includes scoreDelta + recommendations; keep client-
			// readable but not the full HTML.
			scoreDelta:
				typeof r.reportData === "object" && r.reportData
					? ((r.reportData as { scoreDelta?: number }).scoreDelta ?? null)
					: null,
		})),
	});
}
