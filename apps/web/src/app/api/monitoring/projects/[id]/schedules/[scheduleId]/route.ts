import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { computeNextRunAt } from "@/lib/schedule";
import { db, monitoringQueries } from "@beacon/db";
import { MonitoringScheduleUpdateSchema, UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string; scheduleId: string }>;
}

async function rateLimit(request: Request, key: string) {
	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	return checkRateLimit(`${key}:${hashIp(ip)}`, getRateLimitConfig("mutation", "anonymous"));
}

export async function PATCH(request: Request, { params }: RouteContext) {
	const { scheduleId } = await params;
	if (!UuidSchema.safeParse(scheduleId).success) {
		return NextResponse.json({ error: "Ungültige Zeitplan-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "schedule-update");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const body = await request.json().catch(() => null);
	const parsed = MonitoringScheduleUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
	}

	const updates: { frequency?: string; enabled?: boolean; nextRunAt?: Date } = {};
	if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
	if (parsed.data.frequency !== undefined) {
		updates.frequency = parsed.data.frequency;
		updates.nextRunAt = computeNextRunAt(parsed.data.frequency);
	}

	const schedule = await monitoringQueries.updateSchedule(db, scheduleId, updates);
	if (!schedule) {
		return NextResponse.json({ error: "Zeitplan nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ schedule }, { headers: rateLimitHeaders(rate) });
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { scheduleId } = await params;
	if (!UuidSchema.safeParse(scheduleId).success) {
		return NextResponse.json({ error: "Ungültige Zeitplan-ID." }, { status: 400 });
	}

	const rate = await rateLimit(request, "schedule-delete");
	if (!rate.allowed) return createRateLimitResponse(rate);

	const deleted = await monitoringQueries.deleteSchedule(db, scheduleId);
	if (!deleted) {
		return NextResponse.json({ error: "Zeitplan nicht gefunden." }, { status: 404 });
	}
	return NextResponse.json({ deleted: true }, { headers: rateLimitHeaders(rate) });
}
