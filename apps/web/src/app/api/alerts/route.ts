import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { alertQueries, db } from "@beacon/db";
import { AlertCreateSchema, INSTANCE_USER_ID } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const alerts = await alertQueries.getByUserId(db, INSTANCE_USER_ID);
	return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`alert-create:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const body = await request.json().catch(() => null);
	const parsed = AlertCreateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
			{ status: 400 },
		);
	}

	const alert = await alertQueries.create(db, {
		userId: INSTANCE_USER_ID,
		type: parsed.data.type,
		channel: parsed.data.channel,
		config: parsed.data.projectId ? { projectId: parsed.data.projectId } : {},
		enabled: true,
	});

	return NextResponse.json({ alert }, { status: 201, headers: rateLimitHeaders(rate) });
}
