import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { PROVIDER_ENGINES, type ProviderEngine, db, providerKeyQueries } from "@beacon/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ engine: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { engine } = await params;
	if (!(PROVIDER_ENGINES as string[]).includes(engine)) {
		return NextResponse.json({ error: "Ungültige Engine." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`provider-key-delete:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const deleted = await providerKeyQueries.remove(db, engine as ProviderEngine);
	if (deleted.length === 0) {
		return NextResponse.json(
			{ error: "Kein gespeicherter Key für diese Engine." },
			{ status: 404 },
		);
	}
	return NextResponse.json({ engine, deleted: true }, { headers: rateLimitHeaders(rate) });
}
