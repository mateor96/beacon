import { createHash } from "node:crypto";
import { type DbClient, fixQueries } from "@beacon/db";
import { type ParsedAgentsMd, parseAgentsMd } from "@beacon/scanner";
import type { AiModel, TokenUsage } from "@beacon/shared";
import type { ClaudeClient } from "../client.js";
import { calculateCostCents } from "../providers/pricing.js";
import { extractSiteInfo, shouldPropagate } from "./utils.js";

// ── Constants ────────────────────────────────────────────────

export const AGENTS_MD_PROMPT_VERSION = "agents-md-v1";

const DEFAULT_MAX_OUTPUT_TOKENS = 1500;

function resolveMaxOutputTokens(override?: number): number {
	if (override !== undefined) {
		if (Number.isFinite(override) && override > 0 && override <= 8000) return override;
		return DEFAULT_MAX_OUTPUT_TOKENS;
	}
	const raw = process.env.AGENTS_MD_MAX_OUTPUT_TOKENS;
	if (!raw) return DEFAULT_MAX_OUTPUT_TOKENS;
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n > 0 && n <= 8000 ? n : DEFAULT_MAX_OUTPUT_TOKENS;
}

// ── Types ────────────────────────────────────────────────────

export interface AgentsMdCheckSummary {
	id: string;
	status: "pass" | "warn" | "fail";
	score: number;
	summary: string;
	issues: Array<{ message: string; severity: string; context?: string }>;
	details?: Record<string, unknown>;
}

export interface RobotsTxtCheckSummary {
	id: string;
	status: "pass" | "warn" | "fail";
	score: number;
	summary: string;
	issues: Array<{ message: string; severity: string; context?: string }>;
	details?: {
		aiBots?: Record<string, "allowed" | "blocked" | "unspecified">;
		blanketDisallow?: boolean;
		sitemaps?: string[];
		[key: string]: unknown;
	};
}

export interface GenerateAgentsMdInput {
	scanId: string;
	userId: string;
	finalUrl: string;
	htmlContent: string;
	agentsMdCheck?: AgentsMdCheckSummary;
	robotsTxtCheck?: RobotsTxtCheckSummary;
	force?: boolean;
	maxOutputTokens?: number;
}

export type GenerationMethod = "ai-generated" | "template-fallback" | "cache-hit";

export interface GenerateAgentsMdResult {
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

export function computeAgentsMdInputHash(args: {
	scanId: string;
	finalUrl: string;
	modelId: AiModel;
	promptVersion: string;
	agentsMdCheck: AgentsMdCheckSummary | undefined;
	robotsTxtCheck: RobotsTxtCheckSummary | undefined;
	siteInfo: ReturnType<typeof extractSiteInfo>;
}): string {
	const normalizedIssues = (args.agentsMdCheck?.issues ?? [])
		.map((i) => ({ severity: i.severity, message: i.message }))
		.sort((a, b) => a.message.localeCompare(b.message));

	const canonical = JSON.stringify({
		scanId: args.scanId,
		finalUrl: args.finalUrl,
		modelId: args.modelId,
		promptVersion: args.promptVersion,
		check: args.agentsMdCheck
			? {
					status: args.agentsMdCheck.status,
					score: args.agentsMdCheck.score,
					issues: normalizedIssues,
					details: args.agentsMdCheck.details ?? null,
				}
			: null,
		robotsTxt: args.robotsTxtCheck
			? {
					aiBots: args.robotsTxtCheck.details?.aiBots ?? null,
					blanketDisallow: args.robotsTxtCheck.details?.blanketDisallow ?? null,
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
 * Returns the parsed structure if the AGENTS.md meets the minimum bar
 * required by the scanner check, else null. Reuses the same parser as
 * the scanner check so generator output is held to the exact bar the
 * scanner grades.
 */
export function validateAgentsMd(markdown: string): ParsedAgentsMd | null {
	if (markdown.length < 200) return null;
	const parsed = parseAgentsMd(markdown);
	if (parsed.h1Lines.length !== 1) return null;
	if (parsed.h2Sections.length < 2) return null;
	if (parsed.agentSectionCount < 1) return null;
	if (!parsed.hasCapabilities) return null;
	if (parsed.hasHtmlTags) return null;
	return parsed;
}

// ── Template fallback (deterministic) ────────────────────────

export function renderAgentsMdTemplate(
	input: Pick<GenerateAgentsMdInput, "finalUrl">,
	siteInfo: ReturnType<typeof extractSiteInfo>,
): string {
	const url = new URL(input.finalUrl);
	const name = (siteInfo.title?.trim() || url.hostname).slice(0, 120);

	const lines: string[] = [];
	lines.push(`# ${name}`);
	lines.push("");
	lines.push("## General");
	lines.push("");
	lines.push(
		`${name} welcomes AI agents and assistants to interact with publicly available content on this website.`,
	);
	lines.push("");
	lines.push("## Supported Agent Types");
	lines.push("");
	lines.push("- **Content Indexing Bot**: Agents that index and summarize public content");
	lines.push("- **Search Assistant**: Agents that search across site content");
	lines.push("- **General Service Bot**: Agents providing answers based on published information");
	lines.push("");
	lines.push("## Capabilities");
	lines.push("");
	lines.push(
		"AI agents may perform the following actions and use the following permissions on this site:",
	);
	lines.push("");
	lines.push("- Read and index all public pages");
	lines.push("- Extract structured data from public content and endpoints");
	lines.push("- Follow links to discover content scope and services");
	lines.push("- [PLEASE_CUSTOMIZE]: Add specific capabilities for your site");
	lines.push("");
	lines.push("## Rate Limits");
	lines.push("");
	lines.push("- Please respect crawl-delay directives in /robots.txt");
	lines.push("- Maximum 60 requests per minute recommended");
	lines.push("- Honor HTTP 429 (Too Many Requests) and Retry-After headers");
	lines.push("");
	lines.push("## Data & Privacy Policy");
	lines.push("");
	lines.push("- Personal user data must not be stored or reproduced by agents");
	lines.push("- Content may be used for informational purposes in accordance with site terms");
	lines.push("- [PLEASE_CUSTOMIZE]: Link to your privacy policy");
	lines.push("");
	lines.push("## Contact");
	lines.push("");
	lines.push(`- Website: ${url.origin}`);
	lines.push("- Email: [PLEASE_CUSTOMIZE]@example.com");
	lines.push("- AI Agent Policy: [PLEASE_CUSTOMIZE]");

	return `${lines.join("\n")}\n`;
}

// ── Prompt construction ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI-readiness expert generating AGENTS.md files for websites.

AGENTS.md describes how AI agents should interact with a website: permissions, capabilities, rate limits, data usage, and contact information.

STRICT OUTPUT REQUIREMENTS:
- Output ONLY raw Markdown. No code fences. No preamble. No JSON. No explanation.
- Exactly one H1 on the first line: # <Company or Site name>
- Required H2 sections (in this order):
  ## General - Brief description of the organization
  ## Supported Agent Types - Types of AI bots and assistants supported
  ## Capabilities - Bullet list of allowed actions, permissions, endpoints, scope
  ## Rate Limits - Recommended rate limits for AI agent interactions
  ## Data & Privacy Policy - Data usage rules and privacy policy reference
  ## Contact - Contact information for AI-related inquiries
- Each section with "Agent", "Bot", "Assistant", or "Service" in the title must describe agent interaction rules.
- The Capabilities section MUST have a bullet list with items describing actions, permissions, skills, scope, or endpoints.
- No HTML tags. Pure Markdown only.
- Minimum total length: 250 characters.
- Language: English.
- For unknown values use [PLEASE_CUSTOMIZE].
- Do not invent contact details or URLs not derived from the base URL.
- For DACH websites: look for Impressum data in the body text (company name, address, email, Geschaeftsfuehrer).
- Detect the site type from content (E-Commerce, Blog, SaaS, Corporate) and tailor Capabilities accordingly.`;

function buildAgentsMdPrompt(
	input: GenerateAgentsMdInput,
	siteInfo: ReturnType<typeof extractSiteInfo>,
): { systemPrompt: string; userMessage: string } {
	const parts: string[] = [];
	parts.push(`Generate an AGENTS.md file for the website: ${input.finalUrl}`);
	parts.push("");
	parts.push("Site context:");
	if (siteInfo.title) parts.push(`- Title: ${siteInfo.title}`);
	if (siteInfo.metaDescription) parts.push(`- Meta description: ${siteInfo.metaDescription}`);
	if (siteInfo.headings.length > 0) {
		parts.push(`- Headings: ${siteInfo.headings.slice(0, 10).join(" | ")}`);
	}

	if (input.robotsTxtCheck?.details?.aiBots) {
		parts.push("");
		parts.push("Robots.txt AI bot access status:");
		const bots = input.robotsTxtCheck.details.aiBots;
		for (const [bot, status] of Object.entries(bots)) {
			parts.push(`- ${bot}: ${status}`);
		}
		if (input.robotsTxtCheck.details.blanketDisallow) {
			parts.push("- Note: robots.txt has a blanket disallow rule");
		}
	}

	if (input.agentsMdCheck && input.agentsMdCheck.issues.length > 0) {
		parts.push("");
		parts.push("Scanner issues to address:");
		for (const issue of input.agentsMdCheck.issues.slice(0, 5)) {
			parts.push(`- [${issue.severity}] ${issue.message}`);
		}
	}

	parts.push("");
	parts.push("Page body (truncated):");
	parts.push(siteInfo.bodyText.slice(0, 3500));

	return { systemPrompt: SYSTEM_PROMPT, userMessage: parts.join("\n") };
}

// ── Main entrypoint ──────────────────────────────────────────

export async function generateAgentsMd(
	input: GenerateAgentsMdInput,
	client: ClaudeClient,
	db: DbClient,
): Promise<GenerateAgentsMdResult> {
	const siteInfo = extractSiteInfo(input.htmlContent);
	const modelId = client.getModel();

	const inputHash = computeAgentsMdInputHash({
		scanId: input.scanId,
		finalUrl: input.finalUrl,
		modelId,
		promptVersion: AGENTS_MD_PROMPT_VERSION,
		agentsMdCheck: input.agentsMdCheck,
		robotsTxtCheck: input.robotsTxtCheck,
		siteInfo,
	});

	// ── Layer 1: inputHash short-circuit (skip Claude entirely) ─────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "agents_md");
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
		const { systemPrompt, userMessage } = buildAgentsMdPrompt(input, siteInfo);
		const response = await client.complete({
			systemPrompt,
			userMessage,
			operation: "fix-generation",
			maxTokens: resolveMaxOutputTokens(input.maxOutputTokens),
		});
		const normalized = normalizeMarkdown(response.text);
		if (validateAgentsMd(normalized)) {
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
		content = renderAgentsMdTemplate(input, siteInfo);
		method = "template-fallback";
	}

	const contentHash = sha256Hex(content);

	// ── Layer 2: contentHash dedupe (skip the version bump) ────────
	if (!input.force) {
		const latest = await fixQueries.getLatestFix(db, input.scanId, "agents_md");
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
		fixType: "agents_md",
		content,
		contentHash,
		generationMetadata: {
			model: modelId,
			promptVersion: AGENTS_MD_PROMPT_VERSION,
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
