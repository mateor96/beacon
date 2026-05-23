import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

const FIX_TYPE_LABELS: Record<string, string> = {
	llms_txt: "llms.txt",
	json_ld: "JSON-LD",
	agents_md: "agents.md",
};

/**
 * Validation-failed email template (German).
 * Sent when a post-deployment validation terminally fails.
 */
export const renderValidationFailed: TemplateRenderer<"validation-failed"> = (
	data,
	unsubscribeUrl,
): RenderedEmail => {
	const { fixType, siteUrl, checksFailed, dashboardUrl } = data;
	const typeLabel = FIX_TYPE_LABELS[fixType] ?? fixType;

	const subject = "Beacon: Fix-Validierung fehlgeschlagen";

	const failedList = checksFailed
		.map((c) => `<li style="margin: 4px 0; color: #1f2937;">${c}</li>`)
		.join("\n");

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo,</p>
		<p style="margin: 0 0 16px 0;">Die Validierung Ihres <strong>${typeLabel}</strong>-Fixes für <strong>${siteUrl}</strong> ist fehlgeschlagen.</p>
		<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0; width: 100%;">
			<tr>
				<td style="padding: 16px 24px; background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #dc2626;">
					<span style="font-size: 13px; color: #dc2626; font-weight: 600; display: block; margin-bottom: 8px;">Fehlgeschlagene Checks</span>
					<ul style="margin: 0; padding-left: 20px; font-size: 14px;">
						${failedList}
					</ul>
				</td>
			</tr>
		</table>
		<p style="margin: 0 0 24px 0;">
			<a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Im Dashboard ansehen</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Sie können die Validierung im Dashboard erneut ausführen.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
