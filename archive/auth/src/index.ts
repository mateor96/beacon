export const AUTH_VERSION = "0.2.0" as const;

export { getSupabaseConfig, getSupabaseServiceConfig } from "./config.js";
export type { SupabaseConfig, SupabaseServiceConfig } from "./config.js";

export {
	PUBLIC_ROUTES,
	AUTH_ROUTES,
	PROTECTED_PREFIXES,
	DEFAULT_LOGIN_REDIRECT,
	isPublicRoute,
	isAuthRoute,
	isProtectedRoute,
	isApiRoute,
} from "./routes.js";

export { createAppServerClient } from "./server.js";
export { createServiceClient } from "./service.js";
