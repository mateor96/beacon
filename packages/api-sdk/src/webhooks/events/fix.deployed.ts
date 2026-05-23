import { z } from "zod";

export const FixDeployedSchema = z.object({
	deploymentId: z.string().uuid(),
	fixId: z.string().uuid(),
	fixType: z.string(),
	cmsType: z.string(),
	siteUrl: z.string().url(),
	status: z.string(),
});

export type FixDeployedEvent = z.infer<typeof FixDeployedSchema>;
