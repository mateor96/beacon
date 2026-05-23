import { NextResponse } from "next/server";

import { openApiSpec } from "@/lib/openapi/spec";

/**
 * Serves the OpenAPI 3.1 specification as JSON.
 * Public endpoint — no authentication required.
 */
export async function GET() {
	return NextResponse.json(openApiSpec, {
		headers: {
			"Cache-Control": "public, max-age=3600",
		},
	});
}
