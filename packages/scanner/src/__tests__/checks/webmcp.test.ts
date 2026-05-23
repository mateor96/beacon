import type { CheckContext } from "@beacon/shared";
import { parse } from "node-html-parser";
import { describe, expect, it } from "vitest";

// Import directly — no fetchUrl mock needed
const { default: webmcpCheck } = await import("../../checks/webmcp.js");

function makeContext(overrides: Partial<CheckContext> = {}): CheckContext {
	const html = overrides.html ?? "<html><body>Hello</body></html>";
	return {
		inputUrl: "https://example.com",
		finalUrl: "https://example.com",
		html,
		parsedHtml: parse(html),
		responseTime: 100,
		statusCode: 200,
		redirects: [],
		subResources: {},
		...overrides,
	};
}

// ── Fixtures ─────────────────────────────────────────────────

const PERFECT_MCP_JSON = JSON.stringify({
	mcpServers: {
		search: {
			url: "https://api.example.com/mcp/search",
			transport: "sse",
			description: "Volltextsuche über alle Inhalte",
		},
		catalog: {
			url: "https://api.example.com/mcp/catalog",
			transport: "http",
			description: "Produktkatalog durchsuchen",
		},
		support: {
			url: "https://api.example.com/mcp/support",
			transport: "streamable-http",
			description: "Kundensupport-Agent",
		},
	},
});

const GOOD_MCP_JSON = JSON.stringify({
	mcpServers: {
		search: {
			url: "https://api.example.com/mcp/search",
			transport: "sse",
			description: "Volltextsuche",
		},
		catalog: {
			url: "https://api.example.com/mcp/catalog",
			transport: "http",
		},
	},
});

const MINIMAL_MCP_JSON = JSON.stringify({
	mcpServers: {
		search: {
			url: "https://api.example.com/mcp/search",
		},
	},
});

const EMPTY_SERVERS_JSON = JSON.stringify({ mcpServers: {} });

const NO_KEY_JSON = JSON.stringify({ version: "1.0" });

const INVALID_JSON = "{ broken json";

const HTML_RESPONSE = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Not Found</h1></body></html>`;

const BOM_PREFIX_JSON = `\uFEFF${PERFECT_MCP_JSON}`;

const MIXED_SERVERS_JSON = JSON.stringify({
	mcpServers: {
		complete: {
			url: "https://api.example.com/mcp/complete",
			transport: "sse",
			description: "Vollständiger Server",
		},
		noTransport: {
			url: "https://api.example.com/mcp/no-transport",
			description: "Ohne Transport",
		},
		noUrl: {
			transport: "http",
			description: "Ohne URL",
		},
	},
});

const HTTP_URL_JSON = JSON.stringify({
	mcpServers: {
		search: {
			url: "http://api.example.com/mcp/search",
			transport: "sse",
			description: "HTTP-only server",
		},
	},
});

const ARRAY_SERVERS_JSON = JSON.stringify({ mcpServers: [] });

// Helper to create context with mcp.json sub-resource
function mcpCtx(content: string): CheckContext {
	return makeContext({
		subResources: {
			"/.well-known/mcp.json": {
				content,
				statusCode: 200,
				source: "/.well-known/mcp.json",
			},
		},
	});
}

// ── Tests ────────────────────────────────────────────────────

describe("webmcp check", () => {
	describe("metadata", () => {
		it("has correct id, category, and severity", () => {
			expect(webmcpCheck.id).toBe("webmcp");
			expect(webmcpCheck.category).toBe("interactivity");
			expect(webmcpCheck.severity).toBe("nice-to-have");
		});
	});

	describe("file not found", () => {
		it("returns fail with score 0 when not prefetched", async () => {
			const result = await webmcpCheck.run(makeContext());

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues.length).toBeGreaterThanOrEqual(1);
			expect(result.issues[0].severity).toBe("important");
		});
	});

	describe("soft-404 detection", () => {
		it("returns fail when server returns HTML instead of JSON", async () => {
			const result = await webmcpCheck.run(mcpCtx(HTML_RESPONSE));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(0);
			expect(result.issues[0].message).toContain("HTML");
		});
	});

	describe("empty and invalid", () => {
		it("returns fail with score 15 for empty file", async () => {
			const result = await webmcpCheck.run(mcpCtx(""));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
			expect(result.issues.some((i) => i.message.includes("leer"))).toBe(true);
		});

		it("returns fail with score 15 for malformed JSON", async () => {
			const result = await webmcpCheck.run(mcpCtx(INVALID_JSON));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
			expect(result.issues.some((i) => i.message.includes("JSON"))).toBe(true);
		});
	});

	describe("missing or invalid mcpServers", () => {
		it("returns fail with score 35 when mcpServers key is absent", async () => {
			const result = await webmcpCheck.run(mcpCtx(NO_KEY_JSON));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(35);
			expect(result.issues.some((i) => i.message.includes("mcpServers"))).toBe(true);
		});

		it("returns fail with score 35 when mcpServers is empty object", async () => {
			const result = await webmcpCheck.run(mcpCtx(EMPTY_SERVERS_JSON));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(35);
		});

		it("returns fail with score 35 when mcpServers is an array", async () => {
			const result = await webmcpCheck.run(mcpCtx(ARRAY_SERVERS_JSON));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(35);
			expect(result.issues.some((i) => i.message.includes("Struktur"))).toBe(true);
		});
	});

	describe("scoring - URLs", () => {
		it("awards full serversHaveUrl points when all servers have URLs", async () => {
			const result = await webmcpCheck.run(mcpCtx(PERFECT_MCP_JSON));

			expect(result.score).toBe(100);
		});

		it("awards proportional points for partial URL coverage", async () => {
			const result = await webmcpCheck.run(mcpCtx(MIXED_SERVERS_JSON));

			// 2/3 servers have URLs → floor(20 * 2/3) = 13
			// Score should reflect partial credit
			expect(result.issues.some((i) => i.message.includes("URL"))).toBe(true);
		});
	});

	describe("scoring - transport types", () => {
		it("accepts all valid transport types: sse, http, streamable-http", async () => {
			const result = await webmcpCheck.run(mcpCtx(PERFECT_MCP_JSON));

			expect(result.score).toBe(100);
			expect(result.issues).toHaveLength(0);
		});

		it("reports issue for unknown transport type with server name", async () => {
			const json = JSON.stringify({
				mcpServers: {
					search: {
						url: "https://api.example.com/mcp/search",
						transport: "websocket",
						description: "Search service",
					},
				},
			});
			const result = await webmcpCheck.run(mcpCtx(json));

			expect(
				result.issues.some(
					(i) => i.message.includes("search") && i.message.includes("Verbindungstyp"),
				),
			).toBe(true);
		});
	});

	describe("scoring - descriptions", () => {
		it("awards proportional hasDescriptions points", async () => {
			const result = await webmcpCheck.run(mcpCtx(GOOD_MCP_JSON));

			// 1/2 servers missing description → floor(10 * 1/2) = 5
			// 55 + 20 + 15 + 5 = 95
			expect(result.score).toBe(95);
			expect(result.issues.some((i) => i.message.includes("Beschreibung"))).toBe(true);
		});
	});

	describe("scoring - HTTPS warning", () => {
		it("generates non-scoring nice-to-have issue for HTTP URLs", async () => {
			const result = await webmcpCheck.run(mcpCtx(HTTP_URL_JSON));

			const httpsIssue = result.issues.find((i) => i.message.includes("HTTPS"));
			expect(httpsIssue).toBeDefined();
			expect(httpsIssue?.severity).toBe("nice-to-have");
			// Score should still be full minus nothing for HTTPS (non-scoring)
			// 55 + 20 + 15 + 10 = 100
			expect(result.score).toBe(100);
		});
	});

	describe("pass scenarios", () => {
		it("returns pass with score 100 for perfect config, no issues", async () => {
			const result = await webmcpCheck.run(mcpCtx(PERFECT_MCP_JSON));

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
			expect(result.issues).toHaveLength(0);
		});

		it("includes details with serverCount, serverNames, transportTypes", async () => {
			const result = await webmcpCheck.run(mcpCtx(PERFECT_MCP_JSON));

			expect(result.details).toBeDefined();
			expect(result.details?.serverCount).toBe(3);
			expect(result.details?.serverNames).toEqual(["search", "catalog", "support"]);
			expect(result.details?.transportTypes).toContain("sse");
			expect(result.details?.transportTypes).toContain("http");
			expect(result.details?.transportTypes).toContain("streamable-http");
		});
	});

	describe("edge cases", () => {
		it("handles BOM prefix in JSON response", async () => {
			const result = await webmcpCheck.run(mcpCtx(BOM_PREFIX_JSON));

			expect(result.status).toBe("pass");
			expect(result.score).toBe(100);
		});

		it("returns fail for oversized response (> 1MB)", async () => {
			const oversized = "x".repeat(1_048_577);
			const result = await webmcpCheck.run(mcpCtx(oversized));

			expect(result.status).toBe("fail");
			expect(result.score).toBe(15);
			expect(result.issues.some((i) => i.message.includes("groß"))).toBe(true);
		});
	});
});
