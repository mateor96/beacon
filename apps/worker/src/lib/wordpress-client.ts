/**
 * WordPress REST API client for one-click deployment (#280).
 *
 * Handles page CRUD via /wp-json/wp/v2/pages with Basic Auth.
 * 30s timeout, typed error mapping, SSRF-safe (caller controls baseUrl).
 */

const WP_TIMEOUT_MS = 30_000;

export type WpErrorCode =
	| "AUTH_FAILED"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "RATE_LIMITED"
	| "CMS_ERROR"
	| "TIMEOUT"
	| "NETWORK"
	| "UNKNOWN";

export class WordPressApiError extends Error {
	readonly code: WpErrorCode;
	readonly statusCode?: number;

	constructor(code: WpErrorCode, message: string, statusCode?: number) {
		super(message);
		this.name = "WordPressApiError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

function mapHttpStatus(status: number): WpErrorCode {
	if (status === 401) return "AUTH_FAILED";
	if (status === 403) return "PERMISSION_DENIED";
	if (status === 404) return "NOT_FOUND";
	if (status === 429) return "RATE_LIMITED";
	if (status >= 500) return "CMS_ERROR";
	return "UNKNOWN";
}

export interface WpPage {
	id: number;
	slug: string;
	title: { rendered: string };
	content: { rendered: string };
	status: string;
	link: string;
}

export interface CreatePageInput {
	slug: string;
	title: string;
	content: string;
	status?: "publish" | "draft" | "private";
}

export interface WordPressClientConfig {
	baseUrl: string;
	username: string;
	appPassword: string;
}

export class WordPressClient {
	private readonly baseUrl: string;
	private readonly authHeader: string;

	constructor(config: WordPressClientConfig) {
		this.baseUrl = config.baseUrl.replace(/\/$/, "");
		// Strip spaces from app password (WordPress app passwords have spaces for readability)
		const cleanPassword = config.appPassword.replace(/\s/g, "");
		this.authHeader = `Basic ${Buffer.from(`${config.username}:${cleanPassword}`).toString("base64")}`;
	}

	private async request<T>(
		method: string,
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const url = `${this.baseUrl}/wp-json/wp/v2${path}`;
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
				signal: AbortSignal.timeout(WP_TIMEOUT_MS),
				redirect: "follow",
			});
		} catch (err) {
			if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
				throw new WordPressApiError("TIMEOUT", `Request to ${url} timed out`);
			}
			throw new WordPressApiError("NETWORK", err instanceof Error ? err.message : String(err));
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
			throw new WordPressApiError(code, detail, response.status);
		}

		return (await response.json()) as T;
	}

	/**
	 * Fetch a page by slug. Returns null if not found.
	 */
	async getPageBySlug(slug: string): Promise<WpPage | null> {
		const pages = await this.request<WpPage[]>(
			"GET",
			`/pages?slug=${encodeURIComponent(slug)}&status=publish,draft,private`,
		);
		return pages[0] ?? null;
	}

	/**
	 * Create a new WordPress page.
	 */
	async createPage(input: CreatePageInput): Promise<WpPage> {
		return this.request<WpPage>("POST", "/pages", {
			slug: input.slug,
			title: input.title,
			content: input.content,
			status: input.status ?? "publish",
		});
	}

	/**
	 * Update an existing WordPress page's content.
	 */
	async updatePage(pageId: number, update: { content: string }): Promise<WpPage> {
		return this.request<WpPage>("POST", `/pages/${pageId}`, {
			content: update.content,
		});
	}

	/**
	 * Delete a WordPress page (move to trash).
	 */
	async deletePage(pageId: number): Promise<void> {
		await this.request<unknown>("DELETE", `/pages/${pageId}`);
	}
}
