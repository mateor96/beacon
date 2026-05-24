import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { competitorQueries, db, monitoringQueries } from "@beacon/db";
import { CompetitorCreateSchema, UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}
	const competitors = await competitorQueries.getCompetitorsWithLatestBenchmarks(db, id);
	return NextResponse.json({ competitors });
}

export async function POST(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`competitor-create:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	const body = await request.json().catch(() => null);
	const parsed = CompetitorCreateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
			{ status: 400 },
		);
	}

	const competitor = await competitorQueries.create(db, {
		projectId: id,
		name: parsed.data.name,
		domain: parsed.data.domain ?? null,
	});

	return NextResponse.json({ competitor }, { status: 201, headers: rateLimitHeaders(rate) });
}
