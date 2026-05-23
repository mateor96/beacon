/**
 * AC-literal shim for issue #240. The repo convention is
 * `apps/worker/src/processors/*.processor.ts`, so the real processor lives at
 * `../processors/json-ld.processor.ts`. This file exists only to satisfy
 * the literal AC text "BullMQ-Job `generate-json-ld` in `apps/worker`" and
 * provides a stable import path that won't break if the processor file is
 * later renamed.
 */
export { processJsonLd as generateJsonLd } from "../processors/json-ld.processor.js";
