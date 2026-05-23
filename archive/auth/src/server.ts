import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config.js";

export async function createAppServerClient() {
	const { url, anonKey } = getSupabaseConfig();
	const cookieStore = await cookies();
	return createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
				for (const { name, value, options } of cookiesToSet) {
					cookieStore.set(name, value, options);
				}
			},
		},
	});
}
