import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { db, monitoringQueries } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { MonitoringProjectCreateSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Instance-scoped monitoring projects (v0.2 #4). No login: the operator
 * who deploys Beacon owns the instance. Network-level protection (VPN,
 * Cloudflare Access, reverse proxy auth) is the operator's job.
 */

export async function GET() {
	const projects = await monitoringQueries.listAllProjects(db);
	const rows = projects.map((p) => ({
		id: p.id,
		name: p.name,
		websiteUrl: p.websiteUrl,
		brandKeywords: p.brandKeywords,
		competitorKeywords: p.competitorKeywords ?? [],
		createdAt: p.createdAt?.toISOString() ?? null,
		updatedAt: p.updatedAt?.toISOString() ?? null,
	}));
	return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
	const ctReject = assertJsonContentType(request);
	if (ctReject) return ctReject;

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`monitoring-create:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
	}

	const parsed = MonitoringProjectCreateSchema.safeParse(body);
	if (!parsed.success) {
		const first = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
		return NextResponse.json({ error: first }, { status: 400 });
	}
	const { name, websiteUrl, brandKeywords, competitorKeywords } = parsed.data;

	const project = await monitoringQueries.createProject(db, {
		name,
		websiteUrl,
		brandKeywords,
		competitorKeywords: competitorKeywords ?? null,
	});

	// Kick off an initial AI-visibility sweep against the brand. The worker
	// reads the project + brandKeywords and writes a snapshot row.
	const primaryBrand = brandKeywords[0] ?? name;
	await addJob("ai-visibility", {
		projectId: project.id,
		brandName: primaryBrand,
		queryText: `Was ist ${primaryBrand}?`,
	});

	return NextResponse.json(
		{
			id: project.id,
			name: project.name,
			websiteUrl: project.websiteUrl,
			brandKeywords: project.brandKeywords,
			competitorKeywords: project.competitorKeywords ?? [],
		},
		{ status: 201, headers: rateLimitHeaders(rate) },
	);
}
