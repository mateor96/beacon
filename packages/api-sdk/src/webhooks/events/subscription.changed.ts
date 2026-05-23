import { z } from "zod";

export const SubscriptionChangedSchema = z.object({
	userId: z.string().uuid(),
	previousPlan: z.string(),
	newPlan: z.string(),
	changeType: z.string(),
});

export type SubscriptionChangedEvent = z.infer<typeof SubscriptionChangedSchema>;
