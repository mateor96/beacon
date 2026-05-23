import { renderAlertNotification } from "./alert-notification.js";
import { renderAuditReportReady } from "./audit-report-ready.js";
import { renderMilestoneNotification } from "./milestone-notification.js";
import { renderRoiReportReady } from "./roi-report-ready.js";
import { renderScanComplete } from "./scan-complete.js";
import type { TemplateName, TemplateRenderer } from "./types.js";
import { renderValidationFailed } from "./validation-failed.js";
import { renderWelcome } from "./welcome.js";

export type { TemplateName, TemplateDataMap, RenderedEmail, TemplateRenderer } from "./types.js";
export { wrapInLayout, stripHtml } from "./layout.js";
export { renderScanComplete } from "./scan-complete.js";
export { renderWelcome } from "./welcome.js";
export { renderAuditReportReady } from "./audit-report-ready.js";
export { renderAlertNotification } from "./alert-notification.js";
export { renderValidationFailed } from "./validation-failed.js";
export { renderMilestoneNotification } from "./milestone-notification.js";
export { renderRoiReportReady } from "./roi-report-ready.js";

export const templates: { [K in TemplateName]: TemplateRenderer<K> } = {
	"scan-complete": renderScanComplete,
	welcome: renderWelcome,
	"audit-report-ready": renderAuditReportReady,
	"alert-notification": renderAlertNotification,
	"validation-failed": renderValidationFailed,
	"milestone-notification": renderMilestoneNotification,
	"roi-report-ready": renderRoiReportReady,
};
