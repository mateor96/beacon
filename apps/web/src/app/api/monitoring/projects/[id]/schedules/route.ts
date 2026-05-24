import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { computeNextRunAt } from "@/lib/schedule";
import { db, monitoringQueries } from "@beacon/db";
import { MonitoringScheduleCreateSchema, UuidSchema } from "@beacon/shared";
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
	const schedules = await monitoringQueries.getSchedulesByProjectId(db, id);
	return NextResponse.json({ schedules });
}

export async function POST(request: Request, { params }: RouteContext) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) {
		return NextResponse.json({ error: "Ungültige Projekt-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`schedule-create:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) {
		return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 });
	}

	const body = await request.json().catch(() => null);
	const parsed = MonitoringScheduleCreateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Ungültige Frequenz." }, { status: 400 });
	}

	const schedule = await monitoringQueries.createSchedule(db, {
		projectId: id,
		frequency: parsed.data.frequency,
		nextRunAt: computeNextRunAt(parsed.data.frequency),
		enabled: true,
	});

	return NextResponse.json({ schedule }, { status: 201, headers: rateLimitHeaders(rate) });
}
