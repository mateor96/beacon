// Providers
export { createProvider, ConsoleProvider, ResendProvider } from "./providers/index.js";
export type { EmailMessage, EmailProvider, ProviderSendResult } from "./providers/index.js";

// Templates
export {
	templates,
	renderScanComplete,
	renderWelcome,
	renderValidationFailed,
	renderMilestoneNotification,
	renderRoiReportReady,
	wrapInLayout,
	stripHtml,
} from "./templates/index.js";
export type {
	TemplateName,
	TemplateDataMap,
	RenderedEmail,
	TemplateRenderer,
} from "./templates/index.js";

// Unsubscribe tokens
export { mintUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe/token.js";

// CRM / email-marketing adapter (#226)
export {
	NullCrmAdapter,
	ResendCrmAdapter,
	buildLeadPayload,
	resolveCrmAdapter,
} from "./crm/adapter.js";
export type { CrmAdapter, LeadPayload } from "./crm/adapter.js";
