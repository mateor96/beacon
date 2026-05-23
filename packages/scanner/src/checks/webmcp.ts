import type {
	CheckContext,
	CheckPlugin,
	CheckSeverity,
	ScanCheck,
	ScanCheckIssue,
} from "@beacon/shared";
import { CHECK_METADATA_MAP, isHtmlResponse } from "@beacon/shared";

import { defaultRegistry } from "../registry.js";

// ── Scoring weights ──────────────────────────────────────────

const POINTS = {
	exists: 15,
	validJson: 20,
	hasMcpServers: 20,
	serversHaveUrl: 20,
	serversHaveTransport: 15,
	hasDescriptions: 10,
} as const;

const STATUS_THRESHOLD_FAIL = 40;
const STATUS_THRESHOLD_PASS = 80;

const VALID_MCP_TYPES = new Set(["sse", "http", "streamable-http"]);
const MAX_RESPONSE_SIZE = 1_048_576; // 1 MB

// ── Interfaces ───────────────────────────────────────────────

interface McpServerEntry {
	name: string;
	hasValidUrl: boolean;
	hasValidTransport: boolean;
	hasDescription: boolean;
	isHttps: boolean;
	transportType: string | null;
}

interface ParsedMcpJson {
	serverCount: number;
	servers: McpServerEntry[];
	serversWithUrl: number;
	serversWithValidTransport: number;
	serversWithDescription: number;
}

// ── Helpers ──────────────────────────────────────────────────

function addIssue(issues: ScanCheckIssue[], message: string, severity: CheckSeverity): void {
	issues.push({ message, severity });
}

function isValidAbsoluteUrl(value: unknown): boolean {
	if (typeof value !== "string" || value.trim() === "") return false;
	try {
		const url = new URL(value);
		return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== "";
	} catch {
		return false;
	}
}

// ── Parser ───────────────────────────────────────────────────

function parseMcpJson(content: string): ParsedMcpJson | null {
	const cleaned = content.replace(/^\uFEFF/, "");

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return null;
	}

	const obj = parsed as Record<string, unknown>;
	const mcpServers = obj.mcpServers;

	if (mcpServers === undefined || mcpServers === null) {
		return null;
	}

	if (typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
		return null;
	}

	const serversObj = mcpServers as Record<string, unknown>;
	const servers: McpServerEntry[] = [];

	for (const [name, entry] of Object.entries(serversObj)) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			continue;
		}

		const serverEntry = entry as Record<string, unknown>;
		const urlValue = serverEntry.url;
		const hasValidUrl = isValidAbsoluteUrl(urlValue);
		const isHttps = hasValidUrl && typeof urlValue === "string" && urlValue.startsWith("https://");

		const transportValue = serverEntry.transport;
		const hasValidTransport =
			typeof transportValue === "string" &&
			transportValue.trim() !== "" &&
			VALID_MCP_TYPES.has(transportValue);

		const descValue = serverEntry.description;
		const hasDescription = typeof descValue === "string" && descValue.trim() !== "";

		const transportType = hasValidTransport ? (transportValue as string) : null;
		servers.push({ name, hasValidUrl, hasValidTransport, hasDescription, isHttps, transportType });
	}

	return {
		serverCount: servers.length,
		servers,
		serversWithUrl: servers.filter((s) => s.hasValidUrl).length,
		serversWithValidTransport: servers.filter((s) => s.hasValidTransport).length,
		serversWithDescription: servers.filter((s) => s.hasDescription).length,
	};
}

// ── Score calculation ────────────────────────────────────────

function calculateScore(parsed: ParsedMcpJson): { score: number; issues: ScanCheckIssue[] } {
	const issues: ScanCheckIssue[] = [];

	if (parsed.serverCount === 0) {
		addIssue(issues, "Keine gültigen Server-Einträge in mcpServers gefunden", "important");
		return { score: 0, issues };
	}

	let score = POINTS.exists + POINTS.validJson + POINTS.hasMcpServers; // 55

	// serversHaveUrl (proportional)
	score += Math.floor((POINTS.serversHaveUrl * parsed.serversWithUrl) / parsed.serverCount);
	for (const server of parsed.servers) {
		if (!server.hasValidUrl) {
			addIssue(issues, `Server '${server.name}' hat keine gültige URL`, "important");
		}
	}

	// serversHaveTransport (proportional)
	score += Math.floor(
		(POINTS.serversHaveTransport * parsed.serversWithValidTransport) / parsed.serverCount,
	);
	for (const server of parsed.servers) {
		if (!server.hasValidTransport) {
			addIssue(
				issues,
				`Server '${server.name}' hat keinen gültigen Verbindungstyp (erwartet: SSE, HTTP oder Streamable-HTTP)`,
				"nice-to-have",
			);
		}
	}

	// hasDescriptions (proportional)
	score += Math.floor(
		(POINTS.hasDescriptions * parsed.serversWithDescription) / parsed.serverCount,
	);
	for (const server of parsed.servers) {
		if (!server.hasDescription) {
			addIssue(issues, `Server '${server.name}' hat keine Beschreibung`, "nice-to-have");
		}
	}

	// HTTPS warning (non-scoring)
	for (const server of parsed.servers) {
		if (server.hasValidUrl && !server.isHttps) {
			addIssue(issues, `Server '${server.name}' verwendet HTTP statt HTTPS`, "nice-to-have");
		}
	}

	return { score: Math.min(100, score), issues };
}

// ── Lookup ───────────────────────────────────────────────────

function lookupMcpJson(ctx: CheckContext): { content: string } | null {
	const resource = ctx.subResources["/.well-known/mcp.json"];
	if (resource) return { content: resource.content };
	return null;
}

// ── Check implementation ─────────────────────────────────────

const META = CHECK_METADATA_MAP.webmcp;

const webmcpCheck: CheckPlugin = {
	...META,

	async run(ctx: CheckContext): Promise<ScanCheck> {
		const summaryMap = {
			pass: "mcp.json ist vorhanden und beschreibt KI-Schnittstellen für KI-Agenten",
			warn: "mcp.json vorhanden, aber unvollständig — wichtige Server-Angaben fehlen",
			fail: "Keine mcp.json gefunden oder Datei enthält keine gültigen MCP-Server",
		};

		const fetchResult = lookupMcpJson(ctx);

		// File not found
		if (!fetchResult) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: summaryMap.fail,
				issues: [
					{
						message:
							"Keine mcp.json gefunden — KI-Agenten können keine KI-Schnittstellen entdecken",
						severity: "important",
					},
				],
			};
		}

		const { content } = fetchResult;

		// Soft-404: HTML response
		if (isHtmlResponse(content)) {
			return {
				...META,
				status: "fail",
				score: 0,
				summary: summaryMap.fail,
				issues: [
					{
						message:
							"HTML statt JSON unter /.well-known/mcp.json — möglicherweise eine Fehlerseite",
						severity: "important",
					},
				],
			};
		}

		// Response too large
		if (content.length > MAX_RESPONSE_SIZE) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: summaryMap.fail,
				issues: [
					{
						message: "Antwort zu groß (über 1 MB) — mcp.json sollte kompakt sein",
						severity: "important",
					},
				],
			};
		}

		// Empty body
		if (content.trim().length === 0) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists,
				summary: summaryMap.fail,
				issues: [
					{
						message: "mcp.json ist leer — die Datei muss KI-Schnittstellen beschreiben",
						severity: "important",
					},
				],
			};
		}

		// Parse JSON
		const parsed = parseMcpJson(content);

		// Invalid JSON (parseMcpJson returns null for parse errors)
		if (parsed === null) {
			// Distinguish between JSON parse error and structural issues
			const cleaned = content.replace(/^\uFEFF/, "");
			let isValidJson = true;
			let parsedRaw: unknown = null;
			try {
				parsedRaw = JSON.parse(cleaned);
			} catch {
				isValidJson = false;
			}

			if (!isValidJson) {
				return {
					...META,
					status: "fail",
					score: POINTS.exists,
					summary: summaryMap.fail,
					issues: [
						{
							message: "Kein gültiges JSON in mcp.json — die Datei enthält Formatfehler",
							severity: "important",
						},
					],
				};
			}

			// Valid JSON but structural issue (no mcpServers key, wrong type, array, etc.)
			const obj = parsedRaw as Record<string, unknown>;
			const mcpServers = obj?.mcpServers;

			if (
				mcpServers !== undefined &&
				(Array.isArray(mcpServers) || typeof mcpServers !== "object")
			) {
				return {
					...META,
					status: "fail",
					score: POINTS.exists + POINTS.validJson, // 35
					summary: summaryMap.fail,
					issues: [
						{
							message: "mcpServers muss eine Struktur sein, keine Liste oder einzelner Wert",
							severity: "important",
						},
					],
				};
			}

			return {
				...META,
				status: "fail",
				score: POINTS.exists + POINTS.validJson, // 35
				summary: summaryMap.fail,
				issues: [
					{
						message:
							"Kein mcpServers-Schlüssel in mcp.json gefunden — die Datei muss KI-Schnittstellen deklarieren",
						severity: "important",
					},
				],
			};
		}

		// Valid parsed, but 0 valid server entries
		if (parsed.serverCount === 0) {
			return {
				...META,
				status: "fail",
				score: POINTS.exists + POINTS.validJson, // 35
				summary: summaryMap.fail,
				issues: [
					{
						message: "Keine gültigen Server-Einträge in mcpServers gefunden",
						severity: "important",
					},
				],
			};
		}

		// Calculate score
		const result = calculateScore(parsed);

		// Status mapping
		let status: "pass" | "warn" | "fail";
		if (result.score < STATUS_THRESHOLD_FAIL) {
			status = "fail";
		} else if (result.score < STATUS_THRESHOLD_PASS) {
			status = "warn";
		} else {
			status = "pass";
		}

		return {
			...META,
			status,
			score: result.score,
			summary: summaryMap[status],
			issues: result.issues,
			details: {
				serverCount: parsed.serverCount,
				serverNames: parsed.servers.map((s) => s.name),
				serversWithUrl: parsed.serversWithUrl,
				serversWithValidTransport: parsed.serversWithValidTransport,
				serversWithDescription: parsed.serversWithDescription,
				transportTypes: [
					...new Set(
						parsed.servers
							.filter((s) => s.transportType !== null)
							.map((s) => s.transportType as string),
					),
				],
			},
		};
	},
};

defaultRegistry.register(webmcpCheck);

export default webmcpCheck;
export { parseMcpJson, calculateScore, type ParsedMcpJson };
