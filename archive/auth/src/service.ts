import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceConfig } from "./config.js";

export function createServiceClient() {
	const { url, serviceRoleKey } = getSupabaseServiceConfig();
	return createClient(url, serviceRoleKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	});
}
