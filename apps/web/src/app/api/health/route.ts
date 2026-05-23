import { NextResponse } from "next/server";

/**
 * Health/smoke check endpoint for deploy verification.
 * Checks DB and Redis connectivity.
 * Returns 200 when ready, 503 when degraded.
 */
export async function GET() {
	const checks: Record<string, boolean> = {};

	try {
		const { pingDb } = await import("@beacon/db");
		checks.db = await pingDb();
	} catch {
		checks.db = false;
	}

	try {
		const { pingRedis } = await import("@beacon/queue");
		checks.redis = await pingRedis();
	} catch {
		checks.redis = false;
	}

	const healthy = checks.db && checks.redis;

	return NextResponse.json(
		{
			status: healthy ? "ready" : "degraded",
			service: "web",
			checks,
			timestamp: new Date().toISOString(),
		},
		{ status: healthy ? 200 : 503 },
	);
}
