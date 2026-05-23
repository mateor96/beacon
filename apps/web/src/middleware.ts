import { API_SUNSET_DATE, API_VERSION_HEADER, CURRENT_API_VERSION } from "@/lib/api-version";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const response = NextResponse.next();

	const { pathname } = request.nextUrl;

	if (pathname.startsWith("/api/v1/")) {
		response.headers.set(API_VERSION_HEADER, CURRENT_API_VERSION);
	} else if (pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
		response.headers.set(API_VERSION_HEADER, CURRENT_API_VERSION);
		response.headers.set("Deprecation", "true");
		response.headers.set("Sunset", API_SUNSET_DATE);
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
