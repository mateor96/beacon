import { z } from "zod";

export const ExportCompletedSchema = z.object({
	exportId: z.string().uuid(),
	format: z.string(),
	rowCount: z.number().int().nonnegative(),
	downloadUrl: z.string().url(),
});

export type ExportCompletedEvent = z.infer<typeof ExportCompletedSchema>;
