import { stripHtml, wrapInLayout } from "./layout.js";
import type { RenderedEmail, TemplateRenderer } from "./types.js";

/**
 * Welcome email template (German).
 */
export const renderWelcome: TemplateRenderer<"welcome"> = (data, unsubscribeUrl): RenderedEmail => {
	const { fullName, loginUrl } = data;

	const subject = "Willkommen bei Beacon";

	const innerHtml = `
		<p style="margin: 0 0 16px 0;">Hallo ${fullName},</p>
		<p style="margin: 0 0 16px 0;">Willkommen bei Beacon! Wir freuen uns, dich an Bord zu haben.</p>
		<p style="margin: 0 0 16px 0;">Mit Beacon kannst du deine Website analysieren, Verbesserungsvorschlaege erhalten und deine Web-Performance kontinuierlich überwachen.</p>
		<p style="margin: 0 0 24px 0;">
			<a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">Zum Dashboard</a>
		</p>
		<p style="margin: 0; font-size: 13px; color: #94a3b8;">Bei Fragen erreichst du uns jederzeit über unser Dashboard.</p>
	`;

	const html = wrapInLayout(innerHtml, unsubscribeUrl);
	const text = stripHtml(innerHtml);

	return { subject, html, text };
};
