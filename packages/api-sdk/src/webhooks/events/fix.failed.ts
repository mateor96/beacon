import { z } from "zod";

export const FixFailedSchema = z.object({
	deploymentId: z.string().uuid(),
	fixId: z.string().uuid(),
	fixType: z.string(),
	cmsType: z.string(),
	siteUrl: z.string().url(),
	error: z.string(),
	errorCode: z.string(),
});

export type FixFailedEvent = z.infer<typeof FixFailedSchema>;
