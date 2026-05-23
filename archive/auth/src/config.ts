export interface SupabaseConfig {
	url: string;
	anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
	if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
	return { url, anonKey };
}

export interface SupabaseServiceConfig {
	url: string;
	serviceRoleKey: string;
}

export function getSupabaseServiceConfig(): SupabaseServiceConfig {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
	if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
	return { url, serviceRoleKey };
}
