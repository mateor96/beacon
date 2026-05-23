import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { crawlQueries, db, monitoringQueries } from "@beacon/db";
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
		`crawl-trigger:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	const crawl = await crawlQueries.create(db, {
		monitoringProjectId: id,
		rootUrl: project.websiteUrl,
		status: "pending",
	});

	await addJob(
		"crawl",
		{
			crawlId: crawl.id,
			rootUrl: project.websiteUrl,
			maxPages: 200,
			maxDepth: 3,
		},
		{ jobId: `crawl:${crawl.id}` },
	);

	return NextResponse.json(
		{
			crawlId: crawl.id,
			status: crawl.status,
			rootUrl: crawl.rootUrl,
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

	const crawls = await crawlQueries.listForProject(db, id, { limit: 10 });
	return NextResponse.json({
		crawls: crawls.map((c) => ({
			id: c.id,
			rootUrl: c.rootUrl,
			status: c.status,
			pagesFound: c.pagesFound,
			pagesScanned: c.pagesScanned,
			startedAt: c.startedAt?.toISOString() ?? null,
			completedAt: c.completedAt?.toISOString() ?? null,
		})),
	});
}
