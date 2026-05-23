import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type GenerateSchemaOrgInput,
	SCHEMA_ORG_PROMPT_VERSION,
	computeSchemaOrgInputHash,
	generateSchemaOrg,
	renderSchemaOrgTemplate,
	validateJsonLd,
} from "../../generators/schema-org.js";
import { extractExistingJsonLd, extractSiteInfo } from "../../generators/utils.js";

const VALID_JSON_LD = JSON.stringify(
	{
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "Organization", name: "Acme GmbH", url: "https://acme.example" },
			{ "@type": "WebSite", name: "Acme GmbH", url: "https://acme.example" },
		],
	},
	null,
	2,
);

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

const BASE_INPUT: GenerateSchemaOrgInput = {
	scanId: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	finalUrl: "https://acme.example",
	htmlContent: SAMPLE_HTML,
	schemaOrgCheck: {
		id: "schema-org",
		status: "fail",
		score: 0,
		summary: "Kein Schema.org Markup gefunden.",
		issues: [{ message: "Keine JSON-LD Structured Data vorhanden.", severity: "critical" }],
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
		const text = opts.respond ? await opts.respond() : VALID_JSON_LD;
		return {
			text,
			usage: {
				inputTokens: opts.inputTokens ?? 800,
				outputTokens: opts.outputTokens ?? 500,
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

// ── validateJsonLd ──────────────────────────────────────────

describe("validateJsonLd", () => {
	it("accepts valid @graph JSON-LD", () => {
		expect(validateJsonLd(VALID_JSON_LD)).not.toBeNull();
	});

	it("rejects empty string", () => {
		expect(validateJsonLd("")).toBeNull();
	});

	it("rejects plain text that is not JSON", () => {
		expect(validateJsonLd("hello world this is not json at all")).toBeNull();
	});

	it("rejects valid JSON without @context", () => {
		const noCtx = JSON.stringify({
			"@graph": [{ "@type": "Organization", name: "Test", url: "https://test.example" }],
		});
		expect(validateJsonLd(noCtx)).toBeNull();
	});

	it("rejects valid JSON without @type in @graph items", () => {
		const noType = JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [{ name: "Test" }],
		});
		expect(validateJsonLd(noType)).toBeNull();
	});

	it("rejects when @graph is empty", () => {
		const empty = JSON.stringify({ "@context": "https://schema.org", "@graph": [] });
		expect(validateJsonLd(empty)).toBeNull();
	});

	it("rejects when required properties are missing for recognized type", () => {
		const missingUrl = JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [{ "@type": "Organization", name: "Test" }],
		});
		expect(validateJsonLd(missingUrl)).toBeNull();
	});

	it("rejects when no recognized Schema.org type present", () => {
		const unknownType = JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [{ "@type": "FooBarBaz", name: "Test" }],
		});
		expect(validateJsonLd(unknownType)).toBeNull();
	});

	it("accepts single-type JSON-LD without @graph", () => {
		const single = JSON.stringify({
			"@context": "https://schema.org",
			"@type": "Organization",
			name: "Test",
			url: "https://test.example",
		});
		expect(validateJsonLd(single)).not.toBeNull();
	});

	it("rejects JSON array at top level", () => {
		const arr = JSON.stringify([
			{ "@context": "https://schema.org", "@type": "Organization", name: "T", url: "https://t.ex" },
		]);
		expect(validateJsonLd(arr)).toBeNull();
	});
});

// ── computeSchemaOrgInputHash ───────────────────────────────

describe("computeSchemaOrgInputHash", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);
	const existingJsonLd = extractExistingJsonLd(SAMPLE_HTML);
	const args = {
		scanId: BASE_INPUT.scanId,
		finalUrl: BASE_INPUT.finalUrl,
		modelId: "claude-haiku-4-5-20251001" as const,
		promptVersion: SCHEMA_ORG_PROMPT_VERSION,
		schemaOrgCheck: BASE_INPUT.schemaOrgCheck,
		siteInfo,
		existingJsonLd,
	};

	it("is stable across calls with the same input", () => {
		expect(computeSchemaOrgInputHash(args)).toBe(computeSchemaOrgInputHash(args));
	});

	it("differs when finalUrl changes", () => {
		const a = computeSchemaOrgInputHash(args);
		const b = computeSchemaOrgInputHash({ ...args, finalUrl: "https://other.example" });
		expect(a).not.toBe(b);
	});

	it("differs when modelId changes", () => {
		const a = computeSchemaOrgInputHash(args);
		const b = computeSchemaOrgInputHash({ ...args, modelId: "claude-sonnet-4-20250514" });
		expect(a).not.toBe(b);
	});

	it("differs when promptVersion changes", () => {
		const a = computeSchemaOrgInputHash(args);
		const b = computeSchemaOrgInputHash({ ...args, promptVersion: "schema-org-v2" });
		expect(a).not.toBe(b);
	});

	it("is stable when issues are presented in different order", () => {
		const baseCheck = args.schemaOrgCheck;
		if (!baseCheck) throw new Error("args.schemaOrgCheck is required for this test");
		const a = computeSchemaOrgInputHash({
			...args,
			schemaOrgCheck: {
				...baseCheck,
				issues: [
					{ message: "alpha", severity: "critical" },
					{ message: "bravo", severity: "important" },
				],
			},
		});
		const b = computeSchemaOrgInputHash({
			...args,
			schemaOrgCheck: {
				...baseCheck,
				issues: [
					{ message: "bravo", severity: "important" },
					{ message: "alpha", severity: "critical" },
				],
			},
		});
		expect(a).toBe(b);
	});

	it("differs when an issue message changes", () => {
		const baseCheck = args.schemaOrgCheck;
		if (!baseCheck) throw new Error("args.schemaOrgCheck is required for this test");
		const a = computeSchemaOrgInputHash({
			...args,
			schemaOrgCheck: {
				...baseCheck,
				issues: [{ message: "alpha", severity: "critical" }],
			},
		});
		const b = computeSchemaOrgInputHash({
			...args,
			schemaOrgCheck: {
				...baseCheck,
				issues: [{ message: "bravo", severity: "critical" }],
			},
		});
		expect(a).not.toBe(b);
	});
});

// ── renderSchemaOrgTemplate ─────────────────────────────────

describe("renderSchemaOrgTemplate", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);

	it("is deterministic across repeated calls", () => {
		const a = renderSchemaOrgTemplate(BASE_INPUT, siteInfo);
		const b = renderSchemaOrgTemplate(BASE_INPUT, siteInfo);
		expect(a).toBe(b);
	});

	it("produces output that passes validateJsonLd", () => {
		const out = renderSchemaOrgTemplate(BASE_INPUT, siteInfo);
		expect(validateJsonLd(out)).not.toBeNull();
	});

	it("falls back to hostname when title is missing", () => {
		const noTitle = extractSiteInfo("<html><body><p>nothing</p></body></html>");
		const out = renderSchemaOrgTemplate(BASE_INPUT, noTitle);
		expect(out).toContain("acme.example");
		expect(validateJsonLd(out)).not.toBeNull();
	});

	it("contains Organization and WebSite in @graph", () => {
		const out = renderSchemaOrgTemplate(BASE_INPUT, siteInfo);
		const parsed = JSON.parse(out);
		const types = parsed["@graph"].map((item: { "@type": string }) => item["@type"]);
		expect(types).toContain("Organization");
		expect(types).toContain("WebSite");
	});
});

// ── generateSchemaOrg (with mocked client + db) ─────────────

describe("generateSchemaOrg (with mocked client + db)", () => {
	beforeEach(() => {
		// biome-ignore lint/performance/noDelete: env vars must be removed, not stringified
		delete process.env.SCHEMA_ORG_MAX_OUTPUT_TOKENS;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("happy path: ai-generated when Claude returns valid JSON-LD", async () => {
		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateSchemaOrg(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("ai-generated");
		expect(result.costCents).toBeGreaterThan(0);
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
		expect(inserts[0].fixType).toBe("json_ld");
		expect((inserts[0].generationMetadata as { inputHash?: string }).inputHash).toBe(
			result.inputHash,
		);
	});

	it("falls back to template when Claude returns invalid JSON", async () => {
		const { client, completeMock } = makeMockClient({ respond: () => "hello world" });
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateSchemaOrg(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("template-fallback");
		expect(result.costCents).toBe(0);
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});

	it("falls back to template on non-retryable Claude error", async () => {
		const error = Object.assign(new Error("bad request"), { status: 400 });
		const { client, completeMock } = makeMockClient({ throwError: error });
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateSchemaOrg(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("template-fallback");
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});

	it("propagates rate-limit errors so BullMQ can retry", async () => {
		const error = Object.assign(new Error("rate limited"), { status: 429 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		await expect(generateSchemaOrg(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"rate limited",
		);
	});

	it("propagates 401 unauthorized", async () => {
		const error = Object.assign(new Error("unauthorized"), { status: 401 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;

		await expect(generateSchemaOrg(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"unauthorized",
		);
	});

	it("propagates 5xx errors so BullMQ can retry", async () => {
		const error = Object.assign(new Error("server error"), { status: 503 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;

		await expect(generateSchemaOrg(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"server error",
		);
	});

	it("cache-hit: skips Claude when inputHash matches latest row", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const existingJsonLd = extractExistingJsonLd(SAMPLE_HTML);
		const expectedHash = computeSchemaOrgInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: SCHEMA_ORG_PROMPT_VERSION,
			schemaOrgCheck: BASE_INPUT.schemaOrgCheck,
			siteInfo,
			existingJsonLd,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries } = makeMockDb({
			latest: {
				id: "cached",
				version: 7,
				content: VALID_JSON_LD,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateSchemaOrg(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("cache-hit");
		expect(result.fixId).toBe("cached");
		expect(result.version).toBe(7);
		expect(result.costCents).toBe(0);
		expect(completeMock).not.toHaveBeenCalled();
	});

	it("force=true bypasses cache-hit short-circuit", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const existingJsonLd = extractExistingJsonLd(SAMPLE_HTML);
		const expectedHash = computeSchemaOrgInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: SCHEMA_ORG_PROMPT_VERSION,
			schemaOrgCheck: BASE_INPUT.schemaOrgCheck,
			siteInfo,
			existingJsonLd,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb({
			latest: {
				id: "cached",
				version: 7,
				content: VALID_JSON_LD,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateSchemaOrg(
			{ ...BASE_INPUT, force: true },
			client as never,
			{} as never,
		);

		expect(result.method).toBe("ai-generated");
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});
});
