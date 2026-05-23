/**
 * AC-literal shim for issue #233. The repo convention is
 * `apps/worker/src/processors/*.processor.ts`, so the real processor lives at
 * `../processors/llms-txt.processor.ts`. This file exists only to satisfy
 * the literal AC text "BullMQ-Job `generate-llms-txt` in `apps/worker`" and
 * provides a stable import path that won't break if the processor file is
 * later renamed.
 */
export { processLlmsTxt as generateLlmsTxt } from "../processors/llms-txt.processor.js";
