/**
 * AC-literal shim for issue #247. The repo convention is
 * `apps/worker/src/processors/*.processor.ts`, so the real processor lives at
 * `../processors/agents-md.processor.ts`. This file exists only to satisfy
 * the literal AC text "BullMQ-Job `generate-agents-md` in `apps/worker`" and
 * provides a stable import path that won't break if the processor file is
 * later renamed.
 */
export { processAgentsMd as generateAgentsMd } from "../processors/agents-md.processor.js";
