import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

const ALERT_TYPE_LABELS: Record<string, string> = {
	visibility_drop: "Sichtbarkeits-Einbruch",
	new_citation: "Neue Zitierung",
	competitor_gain: "Wettbewerber-Veränderung",
};

/**
 * Alert notification email template (German).
 */
export const renderAlertNotification: TemplateRenderer<"alert-notification"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { alertType, brandName, projectName, summary, currentValue, previousValue, dashboardUrl } =
		data;
	const typeLabel = ALERT_TYPE_LABELS[alertType] ?? alertType;

	const subject = `Beacon Alert: ${typeLabel} — ${projectName}`;

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Für Ihr Projekt <strong>${projectName}</strong> (${brandName}) wurde ein Alert ausgelöst:</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; width: 100%;">
			<tr>
				<td style="padding: 16px 24px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626;">
					<span style="font-size: 13px; color: #dc2626; font-weight: 600; display: block; margin-bottom: 4px;">${typeLabel}</span>
					<span style="font-size: 15px; color: #1f2937; display: block;">${summary}</span>
					<span style="font-size: 13px; color: #6b7280; display: block; margin-top: 8px;">Vorher: ${previousValue} → Nachher: ${currentValue}</span>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 24px 0;">
			<a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Im Dashboard ansehen</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Sie erhalten diese Benachrichtigung, weil Sie einen Alert für dieses Projekt konfiguriert haben.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
