import type { ScanCheck } from "@beacon/shared";
import type { ClaudeClient } from "../client.js";
import type { ValidatedGeneratedFix } from "../schemas.js";
import type { AiResult } from "../types.js";

export interface FixGeneratorContext {
	url: string;
	html: string;
	check: ScanCheck;
	existingContent?: string;
}

export type FixGeneratorFn = (
	ctx: FixGeneratorContext,
	client: ClaudeClient,
) => Promise<AiResult<ValidatedGeneratedFix>>;
