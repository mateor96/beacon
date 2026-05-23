import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config.js";

export function createAppBrowserClient() {
	const { url, anonKey } = getSupabaseConfig();
	return createBrowserClient(url, anonKey, { isSingleton: true });
}
