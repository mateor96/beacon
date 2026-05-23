export { ScanStartedSchema, type ScanStartedEvent } from "./scan.started.js";
export { ScanCompletedSchema, type ScanCompletedEvent } from "./scan.completed.js";
export { ScanFailedSchema, type ScanFailedEvent } from "./scan.failed.js";
export { ScoreChangedSchema, type ScoreChangedEvent } from "./score.changed.js";
export { FixDeployedSchema, type FixDeployedEvent } from "./fix.deployed.js";
export { FixFailedSchema, type FixFailedEvent } from "./fix.failed.js";
export { ExportCompletedSchema, type ExportCompletedEvent } from "./export.completed.js";
export {
	SubscriptionChangedSchema,
	type SubscriptionChangedEvent,
} from "./subscription.changed.js";

import { ExportCompletedSchema } from "./export.completed.js";
import { FixDeployedSchema } from "./fix.deployed.js";
import { FixFailedSchema } from "./fix.failed.js";
import { ScanCompletedSchema } from "./scan.completed.js";
import { ScanFailedSchema } from "./scan.failed.js";
import { ScanStartedSchema } from "./scan.started.js";
import { ScoreChangedSchema } from "./score.changed.js";
import { SubscriptionChangedSchema } from "./subscription.changed.js";

export const WEBHOOK_EVENTS = {
	"scan.started": ScanStartedSchema,
	"scan.completed": ScanCompletedSchema,
	"scan.failed": ScanFailedSchema,
	"score.changed": ScoreChangedSchema,
	"fix.deployed": FixDeployedSchema,
	"fix.failed": FixFailedSchema,
	"export.completed": ExportCompletedSchema,
	"subscription.changed": SubscriptionChangedSchema,
} as const;

export type WebhookEventName = keyof typeof WEBHOOK_EVENTS;

export const WEBHOOK_EVENT_NAMES = Object.keys(WEBHOOK_EVENTS) as WebhookEventName[];
