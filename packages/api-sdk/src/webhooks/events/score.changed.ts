import { z } from "zod";

export const ScoreChangedSchema = z.object({
	projectId: z.string().uuid(),
	websiteUrl: z.string().url(),
	previousScore: z.number().min(0).max(100),
	currentScore: z.number().min(0).max(100),
	delta: z.number(),
	readinessLevel: z.number().int().min(0).max(3),
});

export type ScoreChangedEvent = z.infer<typeof ScoreChangedSchema>;
