import { createHash } from "node:crypto";
import { type DbClient, fixQueries } from "@beacon/db";
import { type ParsedLlmsTxt, parseLlmsTxt } from "@beacon/scanner";
import type { AiModel, TokenUsage } from "@beacon/shared";
import type { ClaudeClient } from "../client.js";
import { calculateCostCents } from "../providers/pricing.js";
import { extractSiteInfo, shouldPropagate } from "./utils.js";

// ── Constants ────────────────────────────────────────────────

export const LLMS_TXT_PROMPT_VERSION = "llms-txt-v1";

const DEFAULT_MAX_OUTPUT_TOKENS = 1500;

/**
 * Resolve the per-call output-token cap. Read fresh on every call so vitest
 * can mutate `process.env.LLMS_TXT_MAX_OUTPUT_TOKENS` between tests without
 * `vi.resetModules()` (review P1 #3).
 */
function resolveMaxOutputTokens(override?: number): number {
	if (override !== undefined) {
		if (Number.isFinite(override) && override > 0 && override <= 8000) return override;
		return DEFAULT_MAX_OUTPUT_TOKENS;
	}
	const raw = process.env.LLMS_TXT_MAX_OUTPUT_TOKENS;
	if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 && n <= 8000 ? n : DEFAULT_MAX_OUTPUT_TOKENS;
}

// ── Types ────────────────────────────────────────────────────

export interface LlmsCheckSummary {
	id: string;
	status: "pass" | "warn" | "fail";
	score: number;
	summary: string;
	issues: Array<{ message: string; severity: string; context?: string }>;
	details?: Record<string, unknown>;
}

export interface GenerateLlmsTxtInput {
	scanId: string;
	userId: string;
	finalUrl: string;
	htmlContent: string;
	/** The scanner's llms-txt check result, if available. */
	llmsCheck?: LlmsCheckSummary;
	/** Bypass both idempotency layers and force a fresh insert. */
	force?: boolean;
	/** Per-call override for the Claude output-token budget. */
	maxOutputTokens?: number;
}

export type GenerationMethod = "ai-generated" | "template-fallback" | "cache-hit";

export interface GenerateLlmsTxtResult {
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

export function computeLlmsTxtInputHash(args: {
	scanId: string;
	finalUrl: string;
	modelId: AiModel;
	promptVersion: string;
	llmsCheck: LlmsCheckSummary | undefined;
	siteInfo: ReturnType<typeof extractSiteInfo>;
}): string {
	const normalizedIssues = (args.llmsCheck?.issues ?? [])
		.map((i) => ({ severity: i.severity, message: i.message }))
		.sort((a, b) => a.message.localeCompare(b.message));

	const canonical = JSON.stringify({
		scanId: args.scanId,
		finalUrl: args.finalUrl,
		modelId: args.modelId,
		promptVersion: args.promptVersion,
		check: args.llmsCheck
			? {
					status: args.llmsCheck.status,
					score: args.llmsCheck.score,
					issues: normalizedIssues,
					details: args.llmsCheck.details ?? null,
				}
			: null,
		siteInfo: {
			title: args.siteInfo.title,
			metaDescription: args.siteInfo.metaDescription,
			headings: args.siteInfo.headings,
			bodyText: args.siteInfo.bodyText,
		},
	});
	return createHash("sha256").update(canonical).digest("hex");
}

// ── Output normalization ─────────────────────────────────────

function normalizeMarkdown(raw: string): string {
	return `${raw
		.replace(/\r\n/g, "\n")
		.replace(/^```(?:markdown)?\n?/i, "")
		.replace(/\n?```$/i, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim()}\n`;
}

function sha256Hex(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

// ── Validator ────────────────────────────────────────────────

/**
 * Returns the parsed structure if the markdown meets the minimum llmstxt.org
 * spec, else null. Reuses the same parser as the scanner check so generator
 * output is held to the exact bar the scanner grades.
 */
export function validateLlmsTxt(markdown: string): ParsedLlmsTxt | null {
	if (markdown.length < 200) return null;
	const parsed = parseLlmsTxt(markdown);
	if (parsed.h1Lines.length !== 1) return null;
	if (!parsed.hasBlockquote) return null;
	if (parsed.h2Sections.length < 2) return null;
	if (parsed.markdownLinks.length < 2) return null;
	if (parsed.hasHtmlTags) return null;
	return parsed;
}

// ── Template fallback (deterministic) ────────────────────────

export function renderLlmsTxtTemplate(
	input: Pick<GenerateLlmsTxtInput, "finalUrl">,
	siteInfo: ReturnType<typeof extractSiteInfo>,
): string {
	const url = new URL(input.finalUrl);
	const title = (siteInfo.title?.trim() || url.hostname).slice(0, 120);
	const description = (
		siteInfo.metaDescription?.trim() || `Automatically generated llms.txt for ${title}.`
	).slice(0, 300);

	const lines: string[] = [];
	lines.push(`# ${title}`);
	lines.push("");
	lines.push(`> ${description}`);
	lines.push("");
	lines.push("## Overview");
	lines.push("");
	lines.push(`- [Homepage](${input.finalUrl}): Main entry point for ${title}.`);

	const headings = siteInfo.headings.slice(0, 4);
	if (headings.length > 0) {
		lines.push("");
		lines.push("## Key topics");
		lines.push("");
		for (const heading of headings) {
			const slug =
				heading
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/(^-|-$)/g, "")
					.slice(0, 40) || "section";
			lines.push(`- [${heading}](${url.origin}/#${slug}): ${heading}`);
		}
	} else {
		lines.push("");
		lines.push("## Resources");
		lines.push("");
		lines.push(`- [About](${url.origin}/): Learn more about ${title}.`);
		lines.push(`- [Contact](${url.origin}/): Reach out to ${title}.`);
	}

	let out = `${lines.join("\n")}\n`;
	if (out.length < 210) {
		out += `\nThis file follows the llmstxt.org specification and was generated from public site metadata for ${title}.\n`;
	}
	return out;
}

// ── Prompt construction ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI-readiness expert generating llms.txt files per the llmstxt.org specification.

STRICT OUTPUT REQUIREMENTS:
- Output ONLY raw Markdown. No code fences. No preamble. No JSON. No explanation.
- Exactly one H1 on the first line: # <Company or Site name>
- A blockquote immediately after the H1: > <1-2 sentence summary>
- At least two H2 sections: ## <Section name>
- Each section contains markdown links formatted: - [Title](URL): Description
- No HTML tags. Pure Markdown only.
- Minimum total length: 200 characters.
- Language: English.
- Do not invent URLs. Only use the base URL provided and descriptive anchors derived from it.`;

function buildLlmsTxtPrompt(
	input: GenerateLlmsTxtInput,
	siteInfo: ReturnType<typeof extractSiteInfo>,
): { systemPrompt: string; userMessage: string } {
	const parts: string[] = [];
	parts.push(`Generate an llms.txt file for the website: ${input.finalUrl}`);
	parts.push("");
	parts.push("Site context:");
	if (siteInfo.title) parts.push(`- Title: ${siteInfo.title}`);
	if (siteInfo.metaDescription) parts.push(`- Meta description: ${siteInfo.metaDescription}`);
	if (siteInfo.headings.length > 0) {
		parts.push(`- Headings: ${siteInfo.headings.slice(0, 10).join(" | ")}`);
	}
	if (input.llmsCheck && input.llmsCheck.issues.length > 0) {
		parts.push("");
		parts.push("Scanner issues to address:");
		for (const issue of input.llmsCheck.issues.slice(0, 5)) {
			parts.push(`- [${issue.severity}] ${issue.message}`);
		}
	}
	parts.push("");
	parts.push("Page body (truncated):");
	parts.push(siteInfo.bodyText.slice(0, 3500));

	return { systemPrompt: SYSTEM_PROMPT, userMessage: parts.join("\n") };
}

// ── Main entrypoint ──────────────────────────────────────────

export async function generateLlmsTxt(
	input: GenerateLlmsTxtInput,
	client: ClaudeClient,
	db: DbClient,
): Promise<GenerateLlmsTxtResult> {
	const siteInfo = extractSiteInfo(input.htmlContent);
	const modelId = client.getModel();

	const inputHash = computeLlmsTxtInputHash({
		scanId: input.scanId,
		finalUrl: input.finalUrl,
		modelId,
		promptVersion: LLMS_TXT_PROMPT_VERSION,
		llmsCheck: input.llmsCheck,
		siteInfo,
	});

	// ── Layer 1: inputHash short-circuit (skip Claude entirely) ─────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "llms_txt");
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
		const { systemPrompt, userMessage } = buildLlmsTxtPrompt(input, siteInfo);
		const response = await client.complete({
			systemPrompt,
			userMessage,
			operation: "fix-generation",
			maxTokens: resolveMaxOutputTokens(input.maxOutputTokens),
		});
		const normalized = normalizeMarkdown(response.text);
		if (validateLlmsTxt(normalized)) {
			content = normalized;
			method = "ai-generated";
			usage = response.usage;
			costCents = calculateCostCents(
				response.usage.model,
				response.usage.inputTokens,
				response.usage.outputTokens,
			);
		}
		// If validation failed we silently fall back; the call cost is sunk
		// either way and the template is deterministic.
	} catch (err) {
		if (shouldPropagate(err)) throw err;
		// Otherwise fall through to template fallback.
	}

	if (!content) {
		content = renderLlmsTxtTemplate(input, siteInfo);
		method = "template-fallback";
	}

	const contentHash = sha256Hex(content);

	// ── Layer 2: contentHash dedupe (skip the version bump) ────────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "llms_txt");
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
		userId: input.userId,
		fixType: "llms_txt",
		content,
		contentHash,
		generationMetadata: {
			model: modelId,
			promptVersion: LLMS_TXT_PROMPT_VERSION,
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
