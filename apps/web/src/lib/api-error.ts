import { NextResponse } from "next/server";

// Lightweight structural ZodError check to avoid a direct `zod` dependency
// in this app package — zod is pulled transitively via @beacon/monitoring.
function isZodError(e: unknown): e is { issues: Array<{ message?: string }> } {
	return (
		typeof e === "object" &&
		e !== null &&
		(e as { name?: string }).name === "ZodError" &&
		Array.isArray((e as { issues?: unknown }).issues)
	);
}

export const SECURITY_HEADERS = {
	"Cache-Control": "private, no-store",
	"X-Content-Type-Options": "nosniff",
};

export class ApiError extends Error {
	code: string;
	status: number;
	constructor(code: string, status: number, message: string) {
		super(message);
		this.code = code;
		this.status = status;
	}
}

export function errorResponse(err: unknown): NextResponse {
	if (err instanceof ApiError) {
		return NextResponse.json(
			{ error: err.code.toLowerCase(), code: err.code, message: err.message },
			{ status: err.status, headers: SECURITY_HEADERS },
		);
	}
	if (isZodError(err)) {
		const message = err.issues[0]?.message ?? "Ungültige Anfrage";
		return NextResponse.json(
			{ error: "validation_error", code: "VALIDATION_ERROR", message },
			{ status: 400, headers: SECURITY_HEADERS },
		);
	}
	// InvalidCursorError from @beacon/monitoring (structural check avoids hard import)
	if (err instanceof Error && (err as { name?: string }).name === "InvalidCursorError") {
		return NextResponse.json(
			{ error: "invalid_cursor", code: "INVALID_CURSOR", message: err.message },
			{ status: 400, headers: SECURITY_HEADERS },
		);
	}
	console.error("Monitoring API error:", err);
	return NextResponse.json(
		{
			error: "internal_error",
			code: "INTERNAL_ERROR",
			message: "Es ist ein interner Fehler aufgetreten.",
		},
		{ status: 500, headers: SECURITY_HEADERS },
	);
}
