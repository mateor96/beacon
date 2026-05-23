import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

function formatDelta(delta: number): string {
	if (delta > 0) return `+${delta}`;
	return String(delta);
}

function getDeltaColor(delta: number): string {
	if (delta > 0) return "#16a34a";
	if (delta < 0) return "#dc2626";
	return "#6b7280";
}

/**
 * ROI report ready email template (German).
 * Sent when a periodic ROI report has been generated for a project.
 */
export const renderRoiReportReady: TemplateRenderer<"roi-report-ready"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { projectName, currentScore, baselineScore, scoreDelta, reportUrl } = data;
	const deltaColor = getDeltaColor(scoreDelta);
	const deltaText = formatDelta(scoreDelta);

	const subject = `Dein ROI-Report ist bereit: ${projectName}`;

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Der ROI-Report für <strong>${projectName}</strong> wurde erstellt.</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; width: 100%;">
			<tr>
				<td style="padding: 16px 24px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
					<span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 8px;">Score-Entwicklung</span>
					<span style="font-size: 24px; color: #334155;">${baselineScore}</span>
					<span style="font-size: 18px; color: #94a3b8;"> → </span>
					<span style="font-size: 24px; color: #334155;">${currentScore}</span>
					<span style="font-size: 20px; font-weight: 700; color: ${deltaColor}; display: block; margin-top: 8px;">${deltaText} Punkte</span>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 24px 0;">
			<a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">ROI-Report ansehen</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Dieser Report wurde automatisch generiert.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
