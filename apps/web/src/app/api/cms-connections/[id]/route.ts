import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse, getRateLimitConfig } from "@/lib/rate-limit";
import { db, fixQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, { params }: RouteContext) {
	const { id } = await params;
	const check = UuidSchema.safeParse(id);
	if (!check.success) {
		return NextResponse.json({ error: "Ungültige Verbindungs-ID." }, { status: 400 });
	}

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`cms-delete:${hashIp(ip)}`,
		getRateLimitConfig("cms", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	try {
		await fixQueries.softDeleteCmsConnection(db, id);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Konnte nicht löschen." },
			{ status: 500 },
		);
	}

	return NextResponse.json({ id });
}
