import { z } from "zod";

export const ScanCompletedSchema = z.object({
	scanId: z.string().uuid(),
	url: z.string().url(),
	overallScore: z.number().min(0).max(100),
	readinessLevel: z.number().int().min(0).max(3),
	checksRun: z.number().int().nonnegative(),
});

export type ScanCompletedEvent = z.infer<typeof ScanCompletedSchema>;
