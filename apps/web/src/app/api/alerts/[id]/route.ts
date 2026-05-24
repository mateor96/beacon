import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { alertQueries, db } from "@beacon/db";
import { AlertUpdateSchema, UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

async function rateLimit(request: Request, key: string) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	return checkRateLimit(`${key}:${hashIp(ip)}`, getRateLimitConfig("mutation", "anonymous"));
}

export async function PATCH(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Alert-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "alert-update");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const body = await request.json().catch(() => null);
	const parsed = AlertUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
	}

	const alert = await alertQueries.update(db, id, parsed.data);
	if (!alert) {
		return NextResponse.json({ error: "Alert nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ alert }, { headers: rateLimitHeaders(rate) });
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Alert-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "alert-delete");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const deleted = await alertQueries.deleteById(db, id);
	if (!deleted) {
		return NextResponse.json({ error: "Alert nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ deleted: true }, { headers: rateLimitHeaders(rate) });
}
