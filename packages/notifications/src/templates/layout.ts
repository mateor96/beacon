/**
 * Base HTML email layout wrapper with Beacon branding.
 */
export function wrapInLayout(innerHtml: string, unsubscribeUrl?: string): string {
	const footerLinks = unsubscribeUrl
		? `<tr>
				<td align="center" style="padding: 20px 30px; font-size: 12px; color: #94a3b8;">
					<a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">E-Mail-Einstellungen ändern</a>
					&nbsp;|&nbsp;
					<a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Abmelden</a>
				</td>
			</tr>`
		: "";

	return `<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Beacon</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
					<!-- Header with accent bar -->
					<tr>
						<td style="height: 4px; background-color: #2563eb;"></td>
					</tr>
					<tr>
						<td style="padding: 24px 30px 16px 30px;">
							<strong style="font-size: 20px; color: #1e293b;">Beacon</strong>
						</td>
					</tr>
					<!-- Content -->
					<tr>
						<td style="padding: 0 30px 30px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
							${innerHtml}
						</td>
					</tr>
					<!-- Footer -->
					${footerLinks}
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/**
 * Strip HTML tags to produce a plain-text version of the email.
 */
export function stripHtml(html: string): string {
	return html
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/tr>/gi, "\n")
		.replace(/<\/td>/gi, " ")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
