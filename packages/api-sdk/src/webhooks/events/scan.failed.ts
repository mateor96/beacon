import { z } from "zod";

export const ScanFailedSchema = z.object({
	scanId: z.string().uuid(),
	url: z.string().url(),
	error: z.string(),
	durationMs: z.number().int().nonnegative(),
});

export type ScanFailedEvent = z.infer<typeof ScanFailedSchema>;
