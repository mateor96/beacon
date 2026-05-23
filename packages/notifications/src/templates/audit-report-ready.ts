import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

function getScoreColor(score: number): string {
	if (score >= 80) return "#16a34a";
	if (score >= 50) return "#ca8a04";
	return "#dc2626";
}

function getScoreLabel(score: number): string {
	if (score >= 80) return "Gut";
	if (score >= 50) return "Verbesserungswürdig";
	return "Kritisch";
}

/**
 * Audit report ready / drip email template (German).
 * Sent after the user unlocks the full report with their email.
 */
export const renderAuditReportReady: TemplateRenderer<"audit-report-ready"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { url, score, reportUrl } = data;
	const scoreColor = getScoreColor(score);
	const scoreLabel = getScoreLabel(score);

	const subject = `Dein vollständiger Beacon-Report: ${url}`;

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Dein vollständiger Beacon-Report für <strong>${url}</strong> ist bereit.</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
			<tr>
				<td style="padding: 16px 24px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
					<span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 4px;">AI-Readiness Score</span>
					<span style="font-size: 36px; font-weight: 700; color: ${scoreColor};">${score}</span>
					<span style="font-size: 14px; color: #94a3b8;">/100</span>
					<span style="font-size: 13px; color: ${scoreColor}; display: block; margin-top: 4px;">${scoreLabel}</span>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 8px 0;">Im Report findest du:</p>
		<ul style="margin: 0 0 24px 0; padding-left: 20px; color: #334155;">
			<li style="margin-bottom: 6px;">Detaillierte Analyse aller 10 Pruefpunkte</li>
			<li style="margin-bottom: 6px;">Konkrete Handlungsempfehlungen</li>
			<li style="margin-bottom: 6px;">Priorisierte Maßnahmen zur Verbesserung</li>
		</ul>
		<p style="margin: 0 0 24px 0;">
			<a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Vollständigen Report ansehen</a>
		</p>
		<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
		<p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;"><strong>Mehr aus deinem Report herausholen?</strong></p>
		<p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b;">
			Mit einem kostenlosen Beacon-Konto erhaeltst du automatisches Monitoring, historische Score-Verlaeufe und erweiterte Fix-Vorschlaege.
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Dieser Report wurde automatisch erstellt.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
