import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type GenerateLlmsTxtInput,
	LLMS_TXT_PROMPT_VERSION,
	computeLlmsTxtInputHash,
	generateLlmsTxt,
	renderLlmsTxtTemplate,
	validateLlmsTxt,
} from "../../generators/llms-txt.js";
import { extractSiteInfo } from "../../generators/utils.js";

const VALID_LLMS_TXT = `# Acme Corporation

> Acme builds tools for AI-readable websites. We help teams make their content discoverable to large language models.

## Products

- [Scanner](https://acme.example/scanner): Scans your site for AI-readiness issues.
- [Reports](https://acme.example/reports): White-label PDF audit reports.

## Resources

- [Documentation](https://acme.example/docs): Full developer documentation.
- [Blog](https://acme.example/blog): Articles on AI search and llms.txt.
`;

const SAMPLE_HTML = `
<!doctype html>
<html lang="en">
	<head>
		<title>Acme Corporation — AI-readiness tools</title>
		<meta name="description" content="Acme builds tools for AI-readable websites." />
	</head>
	<body>
		<h1>Welcome to Acme</h1>
		<h2>What we do</h2>
		<h2>Why us</h2>
		<p>We help teams make their websites discoverable to large language models.</p>
	</body>
</html>
`;

const BASE_INPUT: GenerateLlmsTxtInput = {
	scanId: "00000000-0000-4000-a000-000000000001",
	userId: "00000000-0000-4000-a000-000000000002",
	finalUrl: "https://acme.example",
	htmlContent: SAMPLE_HTML,
	llmsCheck: {
		id: "llms-txt",
		status: "fail",
		score: 0,
		summary: "missing",
		issues: [{ message: "no llms.txt", severity: "critical" }],
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
		const text = opts.respond ? await opts.respond() : VALID_LLMS_TXT;
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

describe("validateLlmsTxt", () => {
	it("accepts a canonical llms.txt", () => {
		expect(validateLlmsTxt(VALID_LLMS_TXT)).not.toBeNull();
	});

	it("rejects when too short", () => {
		expect(validateLlmsTxt("# Hi\n> short\n")).toBeNull();
	});

	it("rejects when no H1", () => {
		const md = VALID_LLMS_TXT.replace("# Acme Corporation", "Acme Corporation");
		expect(validateLlmsTxt(md)).toBeNull();
	});

	it("rejects when two H1s", () => {
		const md = `${VALID_LLMS_TXT}\n# Second title\n`;
		expect(validateLlmsTxt(md)).toBeNull();
	});

	it("rejects when no blockquote", () => {
		const md = VALID_LLMS_TXT.replace(/^> .+$/m, "no quote here");
		expect(validateLlmsTxt(md)).toBeNull();
	});

	it("rejects when fewer than 2 H2 sections", () => {
		const md = VALID_LLMS_TXT.replace("## Resources", "Resources");
		expect(validateLlmsTxt(md)).toBeNull();
	});

	it("rejects when fewer than 2 markdown links", () => {
		const md =
			"# Acme Corporation\n\n> A summary that is long enough for the validator floor of two hundred characters precisely. Padding padding padding padding padding padding padding padding padding padding.\n\n## A\n\nplain text\n\n## B\n\nplain text\n";
		expect(validateLlmsTxt(md)).toBeNull();
	});

	it("rejects when HTML tags present", () => {
		const md = `${VALID_LLMS_TXT}\n<div>oops</div>\n`;
		expect(validateLlmsTxt(md)).toBeNull();
	});
});

describe("computeLlmsTxtInputHash", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);
	const args = {
		scanId: BASE_INPUT.scanId,
		finalUrl: BASE_INPUT.finalUrl,
		modelId: "claude-haiku-4-5-20251001" as const,
		promptVersion: LLMS_TXT_PROMPT_VERSION,
		llmsCheck: BASE_INPUT.llmsCheck,
		siteInfo,
	};

	it("is stable across calls with the same input", () => {
		expect(computeLlmsTxtInputHash(args)).toBe(computeLlmsTxtInputHash(args));
	});

	it("differs when finalUrl changes", () => {
		const a = computeLlmsTxtInputHash(args);
		const b = computeLlmsTxtInputHash({ ...args, finalUrl: "https://other.example" });
		expect(a).not.toBe(b);
	});

	it("differs when modelId changes", () => {
		const a = computeLlmsTxtInputHash(args);
		const b = computeLlmsTxtInputHash({ ...args, modelId: "claude-sonnet-4-20250514" });
		expect(a).not.toBe(b);
	});

	it("differs when promptVersion changes", () => {
		const a = computeLlmsTxtInputHash(args);
		const b = computeLlmsTxtInputHash({ ...args, promptVersion: "llms-txt-v2" });
		expect(a).not.toBe(b);
	});

	it("is stable when issues are presented in different order", () => {
		const baseCheck = args.llmsCheck;
		if (!baseCheck) throw new Error("args.llmsCheck is required for this test");
		const a = computeLlmsTxtInputHash({
			...args,
			llmsCheck: {
				...baseCheck,
				issues: [
					{ message: "alpha", severity: "critical" },
					{ message: "bravo", severity: "important" },
				],
			},
		});
		const b = computeLlmsTxtInputHash({
			...args,
			llmsCheck: {
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
		const baseCheck = args.llmsCheck;
		if (!baseCheck) throw new Error("args.llmsCheck is required for this test");
		const a = computeLlmsTxtInputHash({
			...args,
			llmsCheck: { ...baseCheck, issues: [{ message: "alpha", severity: "critical" }] },
		});
		const b = computeLlmsTxtInputHash({
			...args,
			llmsCheck: { ...baseCheck, issues: [{ message: "bravo", severity: "critical" }] },
		});
		expect(a).not.toBe(b);
	});
});

describe("renderLlmsTxtTemplate", () => {
	const siteInfo = extractSiteInfo(SAMPLE_HTML);

	it("is deterministic across repeated calls", () => {
		const a = renderLlmsTxtTemplate(BASE_INPUT, siteInfo);
		const b = renderLlmsTxtTemplate(BASE_INPUT, siteInfo);
		expect(a).toBe(b);
	});

	it("produces output that passes validateLlmsTxt", () => {
		const out = renderLlmsTxtTemplate(BASE_INPUT, siteInfo);
		expect(validateLlmsTxt(out)).not.toBeNull();
	});

	it("falls back to hostname when title is missing", () => {
		const noTitle = extractSiteInfo("<html><body><h2>X</h2></body></html>");
		const out = renderLlmsTxtTemplate(BASE_INPUT, noTitle);
		expect(out.startsWith("# acme.example")).toBe(true);
	});

	it("uses Resources section when no headings present", () => {
		const noHeadings = extractSiteInfo("<html><body><p>nothing</p></body></html>");
		const out = renderLlmsTxtTemplate(BASE_INPUT, noHeadings);
		expect(out).toContain("## Resources");
		expect(validateLlmsTxt(out)).not.toBeNull();
	});
});

describe("generateLlmsTxt (with mocked client + db)", () => {
	beforeEach(() => {
		// Use `delete` rather than assignment to undefined: setting an env var
		// to undefined coerces to the literal string "undefined", which would
		// silently bypass the per-call env-read fix from review P1 #3.
		// biome-ignore lint/performance/noDelete: env vars must be removed, not stringified
		delete process.env.LLMS_TXT_MAX_OUTPUT_TOKENS;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("happy path: ai-generated when Claude returns valid markdown", async () => {
		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateLlmsTxt(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("ai-generated");
		expect(result.costCents).toBeGreaterThan(0);
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
		expect(inserts[0].fixType).toBe("llms_txt");
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

		const result = await generateLlmsTxt(BASE_INPUT, client as never, {} as never);

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

		const result = await generateLlmsTxt(BASE_INPUT, client as never, {} as never);

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

		await expect(generateLlmsTxt(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"rate limited",
		);
	});

	it("propagates 401 unauthorized so a rotated key fails loud (review fix)", async () => {
		const error = Object.assign(new Error("unauthorized"), { status: 401 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		await expect(generateLlmsTxt(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"unauthorized",
		);
	});

	it("propagates 403 forbidden so a permission change fails loud (review fix)", async () => {
		const error = Object.assign(new Error("forbidden"), { status: 403 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		await expect(generateLlmsTxt(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"forbidden",
		);
	});

	it("propagates 5xx errors so BullMQ can retry", async () => {
		const error = Object.assign(new Error("server error"), { status: 503 });
		const { client } = makeMockClient({ throwError: error });
		const { fakeFixQueries } = makeMockDb();

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		await expect(generateLlmsTxt(BASE_INPUT, client as never, {} as never)).rejects.toThrow(
			"server error",
		);
	});

	it("cache-hit path: skips Claude entirely when inputHash matches latest row", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const expectedHash = computeLlmsTxtInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: LLMS_TXT_PROMPT_VERSION,
			llmsCheck: BASE_INPUT.llmsCheck,
			siteInfo,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries } = makeMockDb({
			latest: {
				id: "cached",
				version: 7,
				content: VALID_LLMS_TXT,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateLlmsTxt(BASE_INPUT, client as never, {} as never);

		expect(result.method).toBe("cache-hit");
		expect(result.fixId).toBe("cached");
		expect(result.version).toBe(7);
		expect(result.costCents).toBe(0);
		expect(completeMock).not.toHaveBeenCalled();
	});

	it("force=true bypasses cache-hit short-circuit", async () => {
		const siteInfo = extractSiteInfo(SAMPLE_HTML);
		const expectedHash = computeLlmsTxtInputHash({
			scanId: BASE_INPUT.scanId,
			finalUrl: BASE_INPUT.finalUrl,
			modelId: "claude-haiku-4-5-20251001",
			promptVersion: LLMS_TXT_PROMPT_VERSION,
			llmsCheck: BASE_INPUT.llmsCheck,
			siteInfo,
		});

		const { client, completeMock } = makeMockClient();
		const { fakeFixQueries, inserts } = makeMockDb({
			latest: {
				id: "cached",
				version: 7,
				content: VALID_LLMS_TXT,
				contentHash: "cached-hash",
				generationMetadata: { inputHash: expectedHash },
			},
		});

		const dbModule = await import("@beacon/db");
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).getLatestFix =
			fakeFixQueries.getLatestFix;
		(dbModule.fixQueries as unknown as typeof fakeFixQueries).createGeneratedFix =
			fakeFixQueries.createGeneratedFix;

		const result = await generateLlmsTxt(
			{ ...BASE_INPUT, force: true },
			client as never,
			{} as never,
		);

		expect(result.method).toBe("ai-generated");
		expect(completeMock).toHaveBeenCalledTimes(1);
		expect(inserts).toHaveLength(1);
	});
});
