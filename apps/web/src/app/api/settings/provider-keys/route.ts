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

function isEngine(value: unknown): value is ProviderEngine {
	return typeof value === "string" && (PROVIDER_ENGINES as string[]).includes(value);
}

/** Store (or rotate) an AI provider key. Body: { engine, value }. */
export async function POST(request: Request) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`provider-key-set:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const body = (await request.json().catch(() => null)) as {
		engine?: unknown;
		value?: unknown;
	} | null;
	if (!body || !isEngine(body.engine)) {
		return NextResponse.json({ error: "Ungültige Engine." }, { status: 400 });
	}
	if (typeof body.value !== "string" || body.value.trim().length === 0) {
		return NextResponse.json({ error: "Key darf nicht leer sein." }, { status: 400 });
	}

	try {
		await providerKeyQueries.setKey(db, body.engine, body.value.trim());
	} catch {
		return NextResponse.json(
			{
				error:
					"PROVIDER_KEYS_KEY ist nicht (korrekt) gesetzt — Key kann nicht verschlüsselt werden.",
			},
			{ status: 503 },
		);
	}

	// Never echo the stored value back.
	return NextResponse.json(
		{ engine: body.engine, saved: true },
		{ headers: rateLimitHeaders(rate) },
	);
}
