import type { FixGeneratorId } from "@beacon/shared";
import type { ClaudeClient } from "../client.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";
import type { FixGeneratorContext, FixGeneratorFn } from "./types.js";

import { generateAgentsMdFix } from "./fix-agents-md.js";
import { generateLlmsTxtFix } from "./fix-llms-txt.js";
import { generateMetaTagsFix } from "./fix-meta-tags.js";
import { generateRobotsTxtFix } from "./fix-robots-txt.js";
import { generateSchemaOrgFix } from "./fix-schema-org.js";

const GENERATOR_MAP: Record<FixGeneratorId, FixGeneratorFn> = {
	"llms-txt": generateLlmsTxtFix,
	"robots-txt": (ctx) => Promise.resolve(generateRobotsTxtFix(ctx)),
	"schema-org": generateSchemaOrgFix,
	"meta-tags": generateMetaTagsFix,
	"agents-md": generateAgentsMdFix,
};

export async function generateFix(
	checkId: FixGeneratorId,
	ctx: FixGeneratorContext,
	client: ClaudeClient,
): Promise<AiResult<ValidatedGeneratedFix>> {
	const generator = GENERATOR_MAP[checkId];
	return generator(ctx, client);
}

export type { FixGeneratorContext } from "./types.js";
