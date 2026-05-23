import { z } from "zod";

export const WebhookEnvelopeSchema = z.object({
	id: z.string().uuid(),
	event: z.string(),
	created_at: z.string().datetime(),
	schema_version: z.literal(1),
	data: z.unknown(),
});

export type WebhookEnvelope<T = unknown> = {
	id: string;
	event: string;
	created_at: string;
	schema_version: 1;
	data: T;
};
