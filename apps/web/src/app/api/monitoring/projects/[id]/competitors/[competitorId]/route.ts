import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { competitorQueries, db } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string; competitorId: string }>;
}

async function rateLimit(request: Request, key: string) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	return checkRateLimit(`${key}:${hashIp(ip)}`, getRateLimitConfig("mutation", "anonymous"));
}

export async function PATCH(request: Request, { params }: RouteContext) {
	const { competitorId } = await params;
	if (!UuidSchema.safeParse(competitorId).success) {
		return NextResponse.json({ error: "Ungültige Wettbewerber-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "competitor-update");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const body = (await request.json().catch(() => null)) as {
		name?: string;
		domain?: string | null;
	} | null;
	if (!body || (body.name === undefined && body.domain === undefined)) {
		return NextResponse.json({ error: "Nichts zu aktualisieren." }, { status: 400 });
	}

	const updates: { name?: string; domain?: string | null } = {};
	if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
	if (body.domain !== undefined) updates.domain = body.domain?.toString().trim() || null;

	const competitor = await competitorQueries.update(db, competitorId, updates);
	if (!competitor) {
		return NextResponse.json({ error: "Wettbewerber nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ competitor }, { headers: rateLimitHeaders(rate) });
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { competitorId } = await params;
	if (!UuidSchema.safeParse(competitorId).success) {
		return NextResponse.json({ error: "Ungültige Wettbewerber-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "competitor-delete");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const deleted = await competitorQueries.deleteById(db, competitorId);
	if (!deleted) {
		return NextResponse.json({ error: "Wettbewerber nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ deleted: true }, { headers: rateLimitHeaders(rate) });
}
