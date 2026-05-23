import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext } from "./types.js";

const PRIMARY_BOTS = [
	"GPTBot",
	"ChatGPT-User",
	"ClaudeBot",
	"Claude-Web",
	"PerplexityBot",
	"Google-Extended",
] as const;

export function generateRobotsTxtFix(ctx: FixGeneratorContext): AiResult<ValidatedGeneratedFix> {
	const details = ctx.check.details as
		| {
				aiBots?: Record<string, "allowed" | "blocked" | "unspecified">;
				blanketDisallow?: boolean;
				sitemaps?: string[];
		  }
		| undefined;

	const aiBots = details?.aiBots ?? {};
	const sitemaps = details?.sitemaps ?? [];
	const origin = new URL(ctx.url).origin;

	// Build a complete robots.txt that allows AI crawlers
	const lines: string[] = ["User-agent: *", "Allow: /", ""];

	for (const bot of PRIMARY_BOTS) {
		const status = aiBots[bot];
		if (status !== "allowed") {
			lines.push(`User-agent: ${bot}`, "Allow: /", "");
		}
	}

	// Add sitemap
	if (sitemaps.length > 0) {
		for (const sitemap of sitemaps) {
			lines.push(`Sitemap: ${sitemap}`);
		}
	} else {
		lines.push(`Sitemap: ${origin}/sitemap.xml`);
	}

	const content = lines.join("\n");

	return {
		ok: true,
		data: {
			checkId: "robots-txt",
			content,
			filename: "robots.txt",
			method: "rule-based",
		},
		usage: [],
	};
}
