/**
 * Webflow API client for one-click deployment (#284).
 *
 * Handles custom code injection via /v2/sites/{siteId}/custom_code
 * and site publishing via /v2/sites/{siteId}/publish.
 * 30s timeout, typed error mapping, Bearer auth.
 */

const WF_TIMEOUT_MS = 30_000;
const WF_BASE_URL = "https://api.webflow.com/v2";

export type WfErrorCode =
	| "AUTH_FAILED"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "RATE_LIMITED"
	| "CMS_ERROR"
	| "TIMEOUT"
	| "NETWORK"
	| "UNKNOWN";

export class WebflowApiError extends Error {
	readonly code: WfErrorCode;
	readonly statusCode?: number;

	constructor(code: WfErrorCode, message: string, statusCode?: number) {
		super(message);
		this.name = "WebflowApiError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

function mapHttpStatus(status: number): WfErrorCode {
	if (status === 401) return "AUTH_FAILED";
	if (status === 403) return "PERMISSION_DENIED";
	if (status === 404) return "NOT_FOUND";
	if (status === 429) return "RATE_LIMITED";
	if (status >= 500) return "CMS_ERROR";
	return "UNKNOWN";
}

export interface WfCustomCodeScript {
	id?: string;
	displayName: string;
	location: "header" | "footer";
	version: string;
	attributes?: Record<string, string>;
	sourceCode: string;
}

export interface WfCustomCodeResponse {
	scripts?: WfCustomCodeScript[];
}

export interface WebflowClientConfig {
	siteId: string;
	apiToken: string;
}

export class WebflowClient {
	private readonly siteId: string;
	private readonly authHeader: string;

	constructor(config: WebflowClientConfig) {
		this.siteId = config.siteId;
		this.authHeader = `Bearer ${config.apiToken}`;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const url = `${WF_BASE_URL}${path}`;
		const headers: Record<string, string> = {
			Authorization: this.authHeader,
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
				signal: AbortSignal.timeout(WF_TIMEOUT_MS),
			});
		} catch (err) {
			if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
				throw new WebflowApiError("TIMEOUT", `Request to ${url} timed out`);
			}
			throw new WebflowApiError("NETWORK", err instanceof Error ? err.message : String(err));
		}

		if (!response.ok) {
			const code = mapHttpStatus(response.status);
			let detail = `HTTP ${response.status}`;
			try {
				const errBody = (await response.json()) as { message?: string };
				if (errBody.message) detail = errBody.message;
			} catch {
				// ignore parse failure
			}
			throw new WebflowApiError(code, detail, response.status);
		}

		// Some endpoints (e.g. publish) may return empty body
		const text = await response.text();
		if (!text) return {} as T;
		return JSON.parse(text) as T;
	}

	/**
	 * Get current custom code scripts for the site.
	 */
	async getCustomCode(): Promise<WfCustomCodeResponse> {
		return this.request<WfCustomCodeResponse>("GET", `/sites/${this.siteId}/custom_code`);
	}

	/**
	 * Set (upsert) head/footer custom code scripts for the site.
	 */
	async upsertCustomCode(scripts: WfCustomCodeScript[]): Promise<WfCustomCodeResponse> {
		return this.request<WfCustomCodeResponse>("PUT", `/sites/${this.siteId}/custom_code`, {
			scripts,
		});
	}

	/**
	 * Publish the site so custom code changes go live.
	 */
	async publishSite(): Promise<void> {
		await this.request<unknown>("POST", `/sites/${this.siteId}/publish`);
	}
}
