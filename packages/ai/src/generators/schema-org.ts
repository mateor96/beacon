import { createHash } from "node:crypto";
import { type DbClient, fixQueries } from "@beacon/db";
import { SCHEMA_ORG_REQUIRED_PROPERTIES } from "@beacon/scanner";
import type { AiModel, TokenUsage } from "@beacon/shared";
import type { ClaudeClient } from "../client.js";
import { calculateCostCents } from "../providers/pricing.js";
import { extractExistingJsonLd, extractSiteInfo, shouldPropagate } from "./utils.js";

// ── Constants ────────────────────────────────────────────────

export const SCHEMA_ORG_PROMPT_VERSION = "schema-org-v1";

const DEFAULT_MAX_OUTPUT_TOKENS = 2000;

function resolveMaxOutputTokens(override?: number): number {
	if (override !== undefined) {
		if (Number.isFinite(override) && override > 0 && override <= 8000) return override;
		return DEFAULT_MAX_OUTPUT_TOKENS;
	}
	const raw = process.env.SCHEMA_ORG_MAX_OUTPUT_TOKENS;
	if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 && n <= 8000 ? n : DEFAULT_MAX_OUTPUT_TOKENS;
}

// ── Types ────────────────────────────────────────────────────

export interface SchemaOrgCheckSummary {
	id: string;
	status: "pass" | "warn" | "fail";
	score: number;
	summary: string;
	issues: Array<{ message: string; severity: string; context?: string }>;
	details?: {
		typesFound?: string[];
		aiRelevantTypes?: string[];
		typeCompleteness?: Record<string, { required: string[]; present: string[]; missing: string[] }>;
		[key: string]: unknown;
	};
}

export interface GenerateSchemaOrgInput {
	scanId: string;
	finalUrl: string;
	htmlContent: string;
	schemaOrgCheck?: SchemaOrgCheckSummary;
	force?: boolean;
	maxOutputTokens?: number;
}

export type GenerationMethod = "ai-generated" | "template-fallback" | "cache-hit";

export interface GenerateSchemaOrgResult {
	fixId: string;
	version: number;
	content: string;
	contentHash: string;
	inputHash: string;
	method: GenerationMethod;
	costCents: number;
	usage?: TokenUsage;
}

// ── Input-hash helper ────────────────────────────────────────

export function computeSchemaOrgInputHash(args: {
	scanId: string;
	finalUrl: string;
	modelId: AiModel;
	promptVersion: string;
	schemaOrgCheck: SchemaOrgCheckSummary | undefined;
	siteInfo: ReturnType<typeof extractSiteInfo>;
	existingJsonLd: string[];
}): string {
	const normalizedIssues = (args.schemaOrgCheck?.issues ?? [])
		.map((i) => ({ severity: i.severity, message: i.message }))
		.sort((a, b) => a.message.localeCompare(b.message));

	const canonical = JSON.stringify({
		scanId: args.scanId,
		finalUrl: args.finalUrl,
		modelId: args.modelId,
		promptVersion: args.promptVersion,
		check: args.schemaOrgCheck
			? {
					status: args.schemaOrgCheck.status,
					score: args.schemaOrgCheck.score,
					issues: normalizedIssues,
					details: args.schemaOrgCheck.details ?? null,
				}
			: null,
		siteInfo: {
			title: args.siteInfo.title,
			metaDescription: args.siteInfo.metaDescription,
			headings: args.siteInfo.headings,
			bodyText: args.siteInfo.bodyText,
		},
		existingJsonLd: args.existingJsonLd.slice(0, 2).map((b) => b.slice(0, 2000)),
	});
	return createHash("sha256").update(canonical).digest("hex");
}

// ── Output normalization ─────────────────────────────────────

function normalizeJsonLdOutput(raw: string): string {
	let cleaned = raw
		.replace(/\r\n/g, "\n")
		.replace(/^```(?:json)?\n?/i, "")
		.replace(/\n?```$/i, "")
		.trim();

	// If Claude wrapped JSON-LD in an array, wrap in @graph envelope
	try {
		const parsed = JSON.parse(cleaned);
		if (Array.isArray(parsed)) {
			cleaned = JSON.stringify({ "@context": "https://schema.org", "@graph": parsed }, null, 2);
		} else {
			cleaned = JSON.stringify(parsed, null, 2);
		}
	} catch {
		// If parse fails, return as-is — validator will reject it
	}

	return cleaned;
}

function sha256Hex(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

// ── Validator ────────────────────────────────────────────────

/**
 * Returns the parsed object if the JSON-LD meets the minimum Schema.org bar,
 * else null. Checks @context, @graph structure, and required properties.
 */
export function validateJsonLd(content: string): Record<string, unknown> | null {
	if (content.length < 50) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return null;
	}

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

	const obj = parsed as Record<string, unknown>;

	// Must have @context containing schema.org
	const ctx = obj["@context"];
	if (typeof ctx !== "string" || !ctx.includes("schema.org")) return null;

	// Must have @graph array or a direct @type
	const graph = obj["@graph"];
	if (Array.isArray(graph)) {
		if (graph.length === 0) return null;
		// Every item in @graph must have @type
		for (const item of graph) {
			if (!item || typeof item !== "object") return null;
			const itemObj = item as Record<string, unknown>;
			if (!itemObj["@type"] || typeof itemObj["@type"] !== "string") return null;
		}
		// At least one recognized type
		const types = graph.map((item) => (item as Record<string, unknown>)["@type"] as string);
		const hasRecognizedType = types.some((t) => t in SCHEMA_ORG_REQUIRED_PROPERTIES);
		if (!hasRecognizedType) return null;

		// Check required properties for recognized types
		for (const item of graph) {
			const itemObj = item as Record<string, unknown>;
			const type = itemObj["@type"] as string;
			const required = SCHEMA_ORG_REQUIRED_PROPERTIES[type];
			if (required) {
				for (const prop of required) {
					if (itemObj[prop] === undefined || itemObj[prop] === null) return null;
				}
			}
		}
	} else if (obj["@type"] && typeof obj["@type"] === "string") {
		// Single-type JSON-LD (no @graph)
		if (!(obj["@type"] in SCHEMA_ORG_REQUIRED_PROPERTIES)) return null;
		const required = SCHEMA_ORG_REQUIRED_PROPERTIES[obj["@type"]];
		if (required) {
			for (const prop of required) {
				if (obj[prop] === undefined || obj[prop] === null) return null;
			}
		}
	} else {
		return null;
	}

	return obj;
}

// ── Template fallback (deterministic) ────────────────────────

export function renderSchemaOrgTemplate(
	input: Pick<GenerateSchemaOrgInput, "finalUrl">,
	siteInfo: ReturnType<typeof extractSiteInfo>,
): string {
	const url = new URL(input.finalUrl);
	const name = (siteInfo.title?.trim() || url.hostname).slice(0, 120);
	const description = (siteInfo.metaDescription?.trim() || `Website of ${name}`).slice(0, 300);

	const jsonLd = {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Organization",
				name,
				url: url.origin,
				description,
			},
			{
				"@type": "WebSite",
				name,
				url: url.origin,
			},
		],
	};

	return JSON.stringify(jsonLd, null, 2);
}

// ── Prompt construction ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a Schema.org structured data expert generating JSON-LD markup for AI discoverability.

STRICT OUTPUT REQUIREMENTS:
- Output ONLY valid JSON. No code fences. No preamble. No explanation.
- The JSON must be a single object with "@context": "https://schema.org"
- Use @graph array to combine multiple types in one block.
- Always include at least Organization (or LocalBusiness if address signals present) and WebSite.
- Detect the page type from URL path and content:
  - /blog/*, /article/*, /news/* -> Article or BlogPosting
  - /product/*, /shop/* -> Product
  - /faq*, /help* -> FAQPage
  - /about, /contact -> Organization (enriched)
  - Default -> Organization + WebSite only
- Every type MUST include all required properties per Schema.org spec:
  - Organization: name, url
  - WebSite: name, url
  - Article/BlogPosting: headline
  - Product: name
  - FAQPage: mainEntity (array of Question with acceptedAnswer)
  - LocalBusiness: name, address
  - BreadcrumbList: itemListElement
- For values you cannot determine from the page, use "[PLEASE_CUSTOMIZE]".
- Do not invent URLs. Only use URLs derived from the provided base URL.
- All string values must be properly JSON-escaped.`;

function buildSchemaOrgPrompt(
	input: GenerateSchemaOrgInput,
	siteInfo: ReturnType<typeof extractSiteInfo>,
	existingJsonLd: string[],
): { systemPrompt: string; userMessage: string } {
	const parts: string[] = [];
	parts.push(`Generate JSON-LD Schema.org markup for: ${input.finalUrl}`);
	parts.push("");
	parts.push("Site context:");
	if (siteInfo.title) parts.push(`- Title: ${siteInfo.title}`);
	if (siteInfo.metaDescription) parts.push(`- Meta description: ${siteInfo.metaDescription}`);
	if (siteInfo.headings.length > 0) {
		parts.push(`- Headings: ${siteInfo.headings.slice(0, 10).join(" | ")}`);
	}

	const pathname = new URL(input.finalUrl).pathname;
	parts.push(`- URL path: ${pathname}`);

	if (input.schemaOrgCheck) {
		if (input.schemaOrgCheck.details?.typesFound) {
			parts.push(
				`- Existing Schema types: ${(input.schemaOrgCheck.details.typesFound as string[]).join(", ")}`,
			);
		}
		if (input.schemaOrgCheck.issues.length > 0) {
			parts.push("");
			parts.push("Scanner issues to address:");
			for (const issue of input.schemaOrgCheck.issues.slice(0, 5)) {
				parts.push(`- [${issue.severity}] ${issue.message}`);
			}
		}
	}

	if (existingJsonLd.length > 0) {
		parts.push("");
		parts.push("Existing JSON-LD (improve, do not duplicate):");
		parts.push(existingJsonLd.slice(0, 2).join("\n").slice(0, 2000));
	}

	parts.push("");
	parts.push("Page body (truncated):");
	parts.push(siteInfo.bodyText.slice(0, 3500));

	return { systemPrompt: SYSTEM_PROMPT, userMessage: parts.join("\n") };
}

// ── Main entrypoint ──────────────────────────────────────────

export async function generateSchemaOrg(
	input: GenerateSchemaOrgInput,
	client: ClaudeClient,
	db: DbClient,
): Promise<GenerateSchemaOrgResult> {
	const siteInfo = extractSiteInfo(input.htmlContent);
	const existingJsonLd = extractExistingJsonLd(input.htmlContent);
	const modelId = client.getModel();

	const inputHash = computeSchemaOrgInputHash({
		scanId: input.scanId,
		finalUrl: input.finalUrl,
		modelId,
		promptVersion: SCHEMA_ORG_PROMPT_VERSION,
		schemaOrgCheck: input.schemaOrgCheck,
		siteInfo,
		existingJsonLd,
	});

	// ── Layer 1: inputHash short-circuit (skip Claude entirely) ─────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "json_ld");
		if (latest && latest.generationMetadata?.inputHash === inputHash) {
			return {
				fixId: latest.id,
				version: latest.version,
				content: latest.content,
				contentHash: latest.contentHash,
				inputHash,
				method: "cache-hit",
				costCents: 0,
			};
		}
	}

	// ── Claude call with structured error classification ───────────
	let content: string | null = null;
	let method: GenerationMethod = "template-fallback";
	let usage: TokenUsage | undefined;
	let costCents = 0;

	try {
		const { systemPrompt, userMessage } = buildSchemaOrgPrompt(input, siteInfo, existingJsonLd);
		const response = await client.complete({
			systemPrompt,
			userMessage,
			operation: "fix-generation",
			maxTokens: resolveMaxOutputTokens(input.maxOutputTokens),
		});
		const normalized = normalizeJsonLdOutput(response.text);
		if (validateJsonLd(normalized)) {
			content = normalized;
			method = "ai-generated";
			usage = response.usage;
			costCents = calculateCostCents(
				response.usage.model,
				response.usage.inputTokens,
				response.usage.outputTokens,
			);
		}
		// If validation failed we silently fall back; the call cost is sunk.
	} catch (err) {
		if (shouldPropagate(err)) throw err;
		// Otherwise fall through to template fallback.
	}

	if (!content) {
		content = renderSchemaOrgTemplate(input, siteInfo);
		method = "template-fallback";
	}

	const contentHash = sha256Hex(content);

	// ── Layer 2: contentHash dedupe (skip the version bump) ────────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "json_ld");
		if (latest && latest.contentHash === contentHash) {
			return {
				fixId: latest.id,
				version: latest.version,
				content: latest.content,
				contentHash,
				inputHash,
				method,
				costCents,
				usage,
			};
		}
	}

	const { id, version } = await fixQueries.createGeneratedFix(db, {
		scanId: input.scanId,
		fixType: "json_ld",
		content,
		contentHash,
		generationMetadata: {
			model: modelId,
			promptVersion: SCHEMA_ORG_PROMPT_VERSION,
			inputTokens: usage?.inputTokens,
			outputTokens: usage?.outputTokens,
			costCents,
			durationMs: usage?.durationMs,
			inputHash,
		},
	});

	return {
		fixId: id,
		version,
		content,
		contentHash,
		inputHash,
		method,
		costCents,
		usage,
	};
}
