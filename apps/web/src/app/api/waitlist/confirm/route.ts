import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get("token");

	if (!token) {
		return NextResponse.redirect(new URL("/warteliste?status=invalid", request.url));
	}

	try {
		const { db, waitlistQueries } = await import("@beacon/db");
		const signup = await waitlistQueries.getByToken(db, token);

		if (!signup) {
			return NextResponse.redirect(new URL("/warteliste?status=invalid", request.url));
		}

		if (signup.status === "confirmed") {
			// Already confirmed — redirect with success
			return NextResponse.redirect(new URL("/warteliste?status=confirmed", request.url));
		}

		await waitlistQueries.confirm(db, signup.id);

		return NextResponse.redirect(new URL("/warteliste?status=confirmed", request.url));
	} catch (_error) {
		return NextResponse.redirect(new URL("/warteliste?status=invalid", request.url));
	}
}
