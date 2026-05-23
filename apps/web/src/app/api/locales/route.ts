import { SECURITY_HEADERS, errorResponse } from "@/lib/api-error";
import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from "@/lib/rate-limit";
import { db, localeQueries } from "@beacon/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/locales — list all active locales (public read, per-IP rate limited)
export async function GET(request: Request) {
	try {
		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		const rl = await checkRateLimit(
			`locales:${hashIp(ip)}`,
			getRateLimitConfig("status", "anonymous"),
		);
		if (!rl.allowed) return createRateLimitResponse(rl);

		const items = await localeQueries.listActiveLocales(db);
		return NextResponse.json({ items }, { headers: SECURITY_HEADERS });
	} catch (err) {
		return errorResponse(err);
	}
}
