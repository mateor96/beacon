/**
 * Shopify Admin API client for one-click deployment (#290).
 *
 * Handles theme asset CRUD via /admin/api/{version}/themes.json
 * and /admin/api/{version}/themes/{themeId}/assets.json.
 * 30s timeout, typed error mapping, X-Shopify-Access-Token auth.
 */

const SHOPIFY_TIMEOUT_MS = 30_000;

export type ShopifyErrorCode =
	| "AUTH_FAILED"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "RATE_LIMITED"
	| "CMS_ERROR"
	| "TIMEOUT"
	| "NETWORK"
	| "UNKNOWN";

export class ShopifyApiError extends Error {
	readonly code: ShopifyErrorCode;
	readonly statusCode?: number;

	constructor(code: ShopifyErrorCode, message: string, statusCode?: number) {
		super(message);
		this.name = "ShopifyApiError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

function mapHttpStatus(status: number): ShopifyErrorCode {
	if (status === 401) return "AUTH_FAILED";
	if (status === 403) return "PERMISSION_DENIED";
	if (status === 404) return "NOT_FOUND";
	if (status === 429) return "RATE_LIMITED";
	if (status >= 500) return "CMS_ERROR";
	return "UNKNOWN";
}

export interface ShopifyTheme {
	id: number;
	name: string;
	role: "main" | "unpublished" | "demo";
	created_at: string;
	updated_at: string;
}

export interface ShopifyAsset {
	key: string;
	value?: string;
	public_url?: string;
	created_at: string;
	updated_at: string;
	content_type?: string;
	size?: number;
	theme_id: number;
}

export interface ShopifyClientConfig {
	shopDomain: string;
	accessToken: string;
	apiVersion: string;
}

export class ShopifyClient {
	private readonly baseUrl: string;
	private readonly accessToken: string;
	private readonly apiVersion: string;

	constructor(config: ShopifyClientConfig) {
		const domain = config.shopDomain.replace(/\/$/, "");
		this.baseUrl = domain.startsWith("https://") ? domain : `https://${domain}`;
		this.accessToken = config.accessToken;
		this.apiVersion = config.apiVersion;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/admin/api/${this.apiVersion}${path}`;
		const headers: Record<string, string> = {
			"X-Shopify-Access-Token": this.accessToken,
			Accept: "application/json",
			"User-Agent": "BeaconBot/1.0",
		};
		if (body) {
			headers["Content-Type"] = "application/json";
		}

		let response: Response;
		try {
			response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
				signal: AbortSignal.timeout(SHOPIFY_TIMEOUT_MS),
			});
		} catch (err) {
			if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
				throw new ShopifyApiError("TIMEOUT", `Request to ${url} timed out`);
			}
			throw new ShopifyApiError("NETWORK", err instanceof Error ? err.message : String(err));
		}

		if (!response.ok) {
			const code = mapHttpStatus(response.status);
			let detail = `HTTP ${response.status}`;
			try {
				const errBody = (await response.json()) as { errors?: string | Record<string, unknown> };
				if (errBody.errors) {
					detail =
						typeof errBody.errors === "string" ? errBody.errors : JSON.stringify(errBody.errors);
				}
			} catch {
				// ignore parse failure
			}
			throw new ShopifyApiError(code, detail, response.status);
		}

		return (await response.json()) as T;
	}

	/**
	 * Get all themes for the shop. Finds the main (published) theme.
	 */
	async getThemes(): Promise<ShopifyTheme[]> {
		const result = await this.request<{ themes: ShopifyTheme[] }>("GET", "/themes.json");
		return result.themes;
	}

	/**
	 * Get a single asset from a theme by key. Returns null if not found.
	 */
	async getAsset(themeId: number, key: string): Promise<ShopifyAsset | null> {
		try {
			const result = await this.request<{ asset: ShopifyAsset }>(
				"GET",
				`/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
			);
			return result.asset;
		} catch (err) {
			if (err instanceof ShopifyApiError && err.code === "NOT_FOUND") {
				return null;
			}
			throw err;
		}
	}

	/**
	 * Create or update a theme asset.
	 */
	async putAsset(themeId: number, key: string, value: string): Promise<ShopifyAsset> {
		const result = await this.request<{ asset: ShopifyAsset }>(
			"PUT",
			`/themes/${themeId}/assets.json`,
			{ asset: { key, value } },
		);
		return result.asset;
	}

	/**
	 * Delete a theme asset.
	 */
	async deleteAsset(themeId: number, key: string): Promise<void> {
		await this.request<unknown>(
			"DELETE",
			`/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`,
		);
	}
}
