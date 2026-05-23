import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

const MILESTONE_TYPE_LABELS: Record<string, string> = {
	score_10_improvement: "+10 Punkte Verbesserung",
	score_25_improvement: "+25 Punkte Verbesserung",
	first_green: "Erstes gruenes Level erreicht",
	level_up: "Readiness Level gestiegen",
	citation_first: "Erste KI-Zitierung",
	citation_milestone: "KI-Zitierungs-Meilenstein",
};

/**
 * Milestone notification email template (German).
 * Sent when a monitoring project reaches a new ROI milestone.
 */
export const renderMilestoneNotification: TemplateRenderer<"milestone-notification"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { milestoneType, projectName, description, currentValue, previousValue, dashboardUrl } =
		data;
	const typeLabel = MILESTONE_TYPE_LABELS[milestoneType] ?? milestoneType;

	const subject = `Beacon Meilenstein: ${description} — ${projectName}`;

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Ihr Projekt <strong>${projectName}</strong> hat einen neuen Meilenstein erreicht:</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; width: 100%;">
			<tr>
				<td style="padding: 16px 24px; background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #16a34a;">
					<span style="font-size: 13px; color: #16a34a; font-weight: 600; display: block; margin-bottom: 4px;">${typeLabel}</span>
					<span style="font-size: 15px; color: #1f2937; display: block;">${description}</span>
					<span style="font-size: 13px; color: #6b7280; display: block; margin-top: 8px;">Vorher: ${previousValue} → Nachher: ${currentValue}</span>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 24px 0;">
			<a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Im Dashboard ansehen</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Sie erhalten diese Benachrichtigung, weil Sie Meilenstein-Benachrichtigungen für dieses Projekt aktiviert haben.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
