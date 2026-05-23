import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	AGENTS_MD_PROMPT_VERSION,
	type GenerateAgentsMdInput,
	computeAgentsMdInputHash,
	generateAgentsMd,
	renderAgentsMdTemplate,
	validateAgentsMd,
} from "../../generators/agents-md.js";
import { extractSiteInfo } from "../../generators/utils.js";

const VALID_AGENTS_MD = `# Acme GmbH

## General

Acme GmbH provides AI-readiness tools for modern websites. AI agents and assistants are welcome to interact with our public content.

## Supported Agent Types

- **Content Indexing Bot**: Agents that index and summarize public content
- **Search Assistant**: Agents that search across documentation and services

## Capabilities

AI agents may perform the following actions and use the following permissions on this site:

- Read and index all public pages
- Search documentation and blog content
- Access product information and pricing endpoints
- Query the public API for site metadata and scope

## Rate Limits

- Maximum 60 requests per minute
- Please respect crawl-delay directives in robots.txt

## Data & Privacy Policy

All interactions must respect our robots.txt directives. Personal data must not be stored beyond the session. See our privacy policy at https://acme.example/datenschutz.

## Contact

For questions about AI agent access: ai-access@acme.example
`;

const SAMPLE_HTML = `
<!doctype html>
<html lang="de">
	<head>
		<title>Acme GmbH — AI-readiness tools</title>
		<meta name="description" content="Acme builds tools for AI-readable websites." />
	</head>
	<body>
		<h1>Willkommen bei Acme</h1>
		<h2>Was wir tun</h2>
		<h2>Warum wir</h2>
		<p>Wir helfen Teams, ihre Websites für KI-Systeme sichtbar zu machen.</p>
	</body>
</html>
`;

const BASE_INPUT: GenerateAgentsMdInput = {
	scanId: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	finalUrl: "https://acme.example",
	htmlContent: SAMPLE_HTML,
	agentsMdCheck: {
		id: "agents-md",
		status: "fail",
		score: 0,
		summary: "Keine AGENTS.md gefunden.",
		issues: [{ message: "Keine AGENTS.md gefunden", severity: "important" }],
	},
	robotsTxtCheck: {
		id: "robots-txt",
		status: "pass",
		score: 100,
		summary: "OK",
		issues: [],
		details: {
			aiBots: { GPTBot: "allowed", ClaudeBot: "allowed", PerplexityBot: "blocked" },
			blanketDisallow: false,
		},
	},
};

function makeMockClient(
	opts: {
		model?: string;
		respond?: (() => string) | (() => Promise<string>);
		throwError?: unknown;
		inputTokens?: number;
		outputTokens?: number;
	} = {},
) {
	const completeMock = vi.fn(async () => {
		if (opts.throwError !== undefined) throw opts.throwError;
		const text = opts.respond ? await opts.respond() : VALID_AGENTS_MD;
		return {
			text,
			usage: {
				inputTokens: opts.inputTokens ?? 800,
				outputTokens: opts.outputTokens ?? 600,
				model: opts.model ?? "claude-haiku-4-5-20251001",
				operation: "fix-generation" as const,
				durationMs: 1234,
			},
		};
	});
	return {
		client: {
			complete: completeMock,
			getModel: () => (opts.model ?? "claude-haiku-4-5-20251001") as never,
		},
		completeMock,
	};
}

interface FakeFixRow {
	id: string;
	version: number;
	content: string;
	contentHash: string;
	generationMetadata: { inputHash?: string };
}

function makeMockDb(
	opts: { latest?: FakeFixRow | null; nextId?: string; nextVersion?: number } = {},
) {
	const inserts: Array<{
		scanId: string;
		userId: string;
		fixType: string;
		content: string;
		contentHash: string;
		generationMetadata: unknown;
	}> = [];
	let latest: FakeFixRow | null = opts.latest ?? null;

	const fakeFixQueries = {
		getLatestFix: vi.fn(async () => latest),
		createGeneratedFix: vi.fn(
			async (
				_db: unknown,
				input: {
					scanId: string;
					userId: string;
					fixType: string;
					content: string;
					contentHash: string;
					generationMetadata?: { inputHash?: string };
				},
			) => {
				inserts.push({
					scanId: input.scanId,
					userId: input.userId,
					fixType: input.fixType,
					content: input.content,
					contentHash: input.contentHash,
					generationMetadata: input.generationMetadata,
				});
				const id = opts.nextId ?? "11111111-1111-4111-a111-111111111111";
				const version = opts.nextVersion ?? (latest?.version ?? 0) + 1;
				latest = {
					id,
					version,
					content: input.content,
					contentHash: input.contentHash,
					generationMetadata: input.generationMetadata ?? {},
				};
				return { id, version };
			},
		),
	};

	return { fakeFixQueries, inserts, getLatest: () => latest };
}

vi.mock("@beacon/db", async () => {
	return {
		fixQueries: {
			getLatestFix: (..._args: unknown[]) => null,
			createGeneratedFix: (..._args: unknown[]) => ({ id: "x", version: 1 }),
		},
	};
});

// ── validateAgentsMd ────────────────────────────────────────

describe("validateAgentsMd", () => {
	it("accepts valid AGENTS.md with all required sections", () => {
		expect(validateAgentsMd(VALID_AGENTS_MD)).not.toBeNull();
	});

	it("rejects empty string", () => {
		expect(validateAgentsMd("")).toBeNull();
	});

	it("rejects content shorter than 200 characters", () => {
		expect(validateAgentsMd("# Title\n\n## Section\n\nShort.")).toBeNull();
	});

	it("rejects when no H1 title present", () => {
		const noH1 = VALID_AGENTS_MD.replace("# Acme GmbH", "Acme GmbH");
		expect(validateAgentsMd(noH1)).toBeNull();
	});

	it("rejects when HTML tags present", () => {
		const withHtml = `${VALID_AGENTS_MD}\n<div>oops</div>\n`;
		expect(validateAgentsMd(withHtml)).toBeNull();
	});

	it("rejects when no agent section present", () => {
		const noAgent = VALID_AGENTS_MD.replace("## Supported Agent Types", "## Supported Types");
		expect(validateAgentsMd(noAgent)).toBeNull();
	});

	it("rejects when fewer than 2 H2 sections", () => {
		const oneH2 = `# Test Site

## Supported Agent Types

- Content Bot: indexes pages and retrieves data with full capabilities
- Search Bot: helps find relevant content at various endpoints
${"Padding text here. ".repeat(10)}
`;
		expect(validateAgentsMd(oneH2)).toBeNull();
	});
});

// ── computeAgentsMdInputHash ────────────────────────────────

describe("computeAgentsMdInputHash", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);
	const args = {
		scanId: BASE_INPUT.scanId,
		finalUrl: BASE_INPUT.finalUrl,
		modelId: "claude-haiku-4-5-20251001" as const,
		promptVersion: AGENTS_MD_PROMPT_VERSION,
		agentsMdCheck: BASE_INPUT.agentsMdCheck,
		robotsTxtCheck: BASE_INPUT.robotsTxtCheck,
		siteInfo,
	};

	it("is stable across calls with the same input", () => {
		expect(computeAgentsMdInputHash(args)).toBe(computeAgentsMdInputHash(args));
	});

	it("differs when finalUrl changes", () => {
		const a = computeAgentsMdInputHash(args);
		const b = computeAgentsMdInputHash({ ...args, finalUrl: "https://other.example" });
		expect(a).not.toBe(b);
	});

	it("differs when modelId changes", () => {
		const a = computeAgentsMdInputHash(args);
		const b = computeAgentsMdInputHash({ ...args, modelId: "claude-sonnet-4-20250514" });
		expect(a).not.toBe(b);
	});

	it("differs when promptVersion changes", () => {
		const a = computeAgentsMdInputHash(args);
		const b = computeAgentsMdInputHash({ ...args, promptVersion: "agents-md-v2" });
		expect(a).not.toBe(b);
	});

	it("is stable when issues are presented in different order", () => {
		const baseCheck = args.agentsMdCheck;
		if (!baseCheck) throw new Error("BASE_INPUT.agentsMdCheck is required for this test");
		const a = computeAgentsMdInputHash({
			...args,
			agentsMdCheck: {
				...baseCheck,
				issues: [
					{ message: "alpha", severity: "critical" },
					{ message: "bravo", severity: "important" },
				],
			},
		});
		const b = computeAgentsMdInputHash({
			...args,
			agentsMdCheck: {
				...baseCheck,
				issues: [
					{ message: "bravo", severity: "important" },
					{ message: "alpha", severity: "critical" },
				],
			},
		});
		expect(a).toBe(b);
	});

	it("differs when robotsTxtCheck changes", () => {
		const a = computeAgentsMdInputHash(args);
		const b = computeAgentsMdInputHash({ ...args, robotsTxtCheck: undefined });
		expect(a).not.toBe(b);
	});
});

// ── renderAgentsMdTemplate ──────────────────────────────────

describe("renderAgentsMdTemplate", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);

	it("is deterministic across repeated calls", () => {
		const a = renderAgentsMdTemplate(BASE_INPUT, siteInfo);
		const b = renderAgentsMdTemplate(BASE_INPUT, siteInfo);
		expect(a).toBe(b);
	});

	it("produces output that passes validateAgentsMd", () => {
		const out = renderAgentsMdTemplate(BASE_INPUT, siteInfo);
		expect(validateAgentsMd(out)).not.toBeNull();
	});

	it("falls back to hostname when title is missing", () => {
		const noTitle = extractSiteInfo("<html><body><p>nothing</p></body></html>");
		const out = renderAgentsMdTemplate(BASE_INPUT, noTitle);
		expect(out).toContain("acme.example");
		expect(validateAgentsMd(out)).not.toBeNull();
	});

	it("contains required section keywords", () => {
		const out = renderAgentsMdTemplate(BASE_INPUT, siteInfo);
		expect(out).toContain("## Supported Agent Types");
		expect(out).toContain("## Capabilities");
		expect(out).toContain("## Contact");
	});
});

// ── generateAgentsMd (with mocked client + db) ──────────────

describe("generateAgentsMd (with mocked client + db)", () => {
	beforeEach(() => {
		// biome-ignore lint/performance/noDelete: env vars must be removed, not stringified
		delete process.env.AGENTS_MD_MAX_OUTPUT_TOKENS;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("happy path: ai-generated when Claude returns valid AGENTS.md", async () => {
		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateAgentsMd(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("ai-generated");
		expect(result.costCents).toBeGreaterThan(0);
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
		expect(inserts[0].fixType).toBe("agents_md");
		expect((inserts[0].generationMetadata as { inputHash?: string }).inputHash).toBe(
			result.inputHash,
		);
	});

	it("falls back to template when Claude returns invalid markdown", async () => {
		const { client, completeMock } = makeMockClient({ respond: () => "hello world" });
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateAgentsMd(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("template-fallback");
		expect(result.costCents).toBe(0);
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});

	it("falls back to template on non-retryable Claude error", async () => {
		const error = Object.assign(new Error("bad request"), { status: 400 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateAgentsMd(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("template-fallback");
		expect(inserts).toHaveLength(1);
	});

	it("propagates rate-limit errors so BullMQ can retry", async () => {
		const error = Object.assign(new Error("rate limited"), { status: 429 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;

		await expect(generateAgentsMd(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"rate limited",
		);
	});

	it("propagates 5xx errors so BullMQ can retry", async () => {
		const error = Object.assign(new Error("server error"), { status: 503 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;

		await expect(generateAgentsMd(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"server error",
		);
	});

	it("cache-hit: skips Claude when inputHash matches latest row", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const expectedHash = computeAgentsMdInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: AGENTS_MD_PROMPT_VERSION,
			agentsMdCheck: BASE_INPUT.agentsMdCheck,
			robotsTxtCheck: BASE_INPUT.robotsTxtCheck,
			siteInfo,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries } = makeMockDb({
			latest: {
				id: "cached",
				version: 5,
				content: VALID_AGENTS_MD,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;

		const result = await generateAgentsMd(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("cache-hit");
		expect(result.fixId).toBe("cached");
		expect(result.version).toBe(5);
		expect(result.costCents).toBe(0);
		expect(completeMock).not.toHaveBeenCalled();
	});

	it("force=true bypasses cache-hit short-circuit", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const expectedHash = computeAgentsMdInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: AGENTS_MD_PROMPT_VERSION,
			agentsMdCheck: BASE_INPUT.agentsMdCheck,
			robotsTxtCheck: BASE_INPUT.robotsTxtCheck,
			siteInfo,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb({
			latest: {
				id: "cached",
				version: 5,
				content: VALID_AGENTS_MD,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateAgentsMd(
			{ ...BASE_INPUT, force: true },
			client as never,
			{} as never,
		);

		expect(result.method).toBe("ai-generated");
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});
});
