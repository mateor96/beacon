import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { db, webhookQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

const PatchSchema = z.object({
	active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
	const ctReject = assertJsonContentType(request);
	if (ctReject) return ctReject;

	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Endpoint-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`webhook-update:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
	}

	const parsed = PatchSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
	}

	const existing = await webhookQueries.getById(db, id);
	if (!existing) {
		return NextResponse.json({ error: "Endpoint nicht gefunden." }, { status: 404 });
	}

	await webhookQueries.update(db, id, { active: parsed.data.active });
	return NextResponse.json({ id, active: parsed.data.active ?? existing.active });
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Endpoint-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`webhook-delete:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	const existing = await webhookQueries.getById(db, id);
	if (!existing) {
		return NextResponse.json({ error: "Endpoint nicht gefunden." }, { status: 404 });
	}

	await webhookQueries.deleteById(db, id);
	return NextResponse.json({ id });
}
