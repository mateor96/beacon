import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "./config.js";
import { DEFAULT_LOGIN_REDIRECT, isApiRoute, isAuthRoute, isProtectedRoute } from "./routes.js";

// Security model: allow-by-default.
// - PROTECTED_PREFIXES require authentication (redirect to /login or 401).
// - AUTH_ROUTES (/login, /signup) redirect authenticated users to dashboard.
// - All other routes (public, auth infrastructure, unknown) pass through.
export async function updateSession(request: NextRequest) {
	const { url, anonKey } = getSupabaseConfig();
	let supabaseResponse = NextResponse.next({ request });

	const supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
				for (const { name, value } of cookiesToSet) {
					request.cookies.set(name, value);
				}
				supabaseResponse = NextResponse.next({ request });
				for (const { name, value, options } of cookiesToSet) {
					supabaseResponse.cookies.set(name, value, options);
				}
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();
	const pathname = request.nextUrl.pathname;

	// Protected route + no user → redirect (or 401 for API)
	if (isProtectedRoute(pathname) && !user) {
		if (isApiRoute(pathname)) {
			return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
		}
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/login";
		loginUrl.searchParams.set("next", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Auth route + logged-in user → redirect to dashboard
	if (isAuthRoute(pathname) && user) {
		return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, request.url));
	}

	return supabaseResponse;
}
