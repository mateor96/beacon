import { z } from "zod";

export const ScanStartedSchema = z.object({
	scanId: z.string().uuid(),
	url: z.string().url(),
	triggeredBy: z.string(),
});

export type ScanStartedEvent = z.infer<typeof ScanStartedSchema>;
