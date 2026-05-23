import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

function getScoreColor(score: number): string {
	if (score >= 80) return "#16a34a";
	if (score >= 50) return "#ca8a04";
	return "#dc2626";
}

/**
 * Scan completion notification template (German).
 */
export const renderScanComplete: TemplateRenderer<"scan-complete"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { url, score, reportUrl } = data;
	const scoreColor = getScoreColor(score);

	const subject = `Dein Scan ist fertig: ${url}`;

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Dein Scan für <strong>${url}</strong> ist abgeschlossen.</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
			<tr>
				<td style="padding: 16px 24px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
					<span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 4px;">Score</span>
					<span style="font-size: 36px; font-weight: 700; color: ${scoreColor};">${score}</span>
					<span style="font-size: 14px; color: #94a3b8;">/100</span>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 24px 0;">
			<a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Ergebnisse ansehen</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Dieser Scan wurde automatisch durchgeführt.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
