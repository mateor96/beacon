/**
 * Generates the INSTALLATIONSANLEITUNG.md for the fix ZIP bundle (#263).
 *
 * Produces German step-by-step instructions tailored to the detected
 * CMS when known; falls back to a generic "any CMS / static host"
 * variant otherwise.
 */

export type CmsHint = "wordpress" | "webflow" | "shopify" | null;

export interface FixEntry {
	path: string;
	fixType: string;
}

export function buildInstallGuide(opts: {
	cms: CmsHint;
	fixes: FixEntry[];
	scanUrl: string;
}): string {
	const header = `# Installationsanleitung

Diese Anleitung führt Sie durch die Installation der mitgelieferten Beacon-Fixes
für Ihre Website: **${opts.scanUrl}**.

`;

	const fileList = opts.fixes.length
		? `## Enthaltene Dateien

${opts.fixes.map((f) => `- \`${f.path}\` (${f.fixType})`).join("\n")}

`
		: "";

	const cmsSection = (() => {
		switch (opts.cms) {
			case "wordpress":
				return `## Installation auf WordPress

1. Laden Sie die Dateien \`llms.txt\` und \`AGENTS.md\` in Ihr WordPress-Root-Verzeichnis hoch (via FTP oder Dateimanager in cPanel).
2. Für \`schema.jsonld\`: öffnen Sie Ihr Theme-\`header.php\` und fuegen Sie vor \`</head>\` ein \`<script type="application/ld+json">\`-Tag mit dem Inhalt ein. Alternativ installieren Sie das Plugin "Insert Headers and Footers".
3. Prüfen Sie, dass \`https://${new URL(opts.scanUrl).hostname}/llms.txt\` erreichbar ist.
`;
			case "webflow":
				return `## Installation auf Webflow

1. Öffnen Sie **Project Settings → Custom Code → Head Code** und fuegen Sie den Inhalt von \`schema.jsonld\` als \`<script type="application/ld+json">...</script>\` ein.
2. Für \`llms.txt\` und \`AGENTS.md\`: Laden Sie die Dateien als "Assets" hoch und verweisen Sie in der Robots-Konfiguration darauf. Webflow bietet leider keine direkte File-Serving-Funktion — Alternativ: setzen Sie einen Reverse-Proxy mit einer statischen Subdomain.
3. Publizieren Sie das Projekt.
`;
			case "shopify":
				return `## Installation auf Shopify

1. Öffnen Sie **Online Store → Themes → Actions → Edit code**.
2. Für \`schema.jsonld\`: öffnen Sie \`layout/theme.liquid\` und fuegen Sie ein \`<script type="application/ld+json">\`-Tag in den \`<head>\` ein.
3. Für \`llms.txt\` und \`AGENTS.md\`: Shopify laesst nur vorgegebene Dateipfade serven. Richten Sie eine Shopify-Page unter \`/pages/llms-txt\` und \`/pages/agents-md\` ein — oder verwenden Sie einen Cloudflare Worker als Proxy.
4. Speichern und Theme veroeffentlichen.
`;
			default:
				return `## Allgemeine Installation

1. Laden Sie die Dateien in das Root-Verzeichnis Ihrer Domain hoch (\`/llms.txt\`, \`/AGENTS.md\`).
2. Für \`schema.jsonld\`: fuegen Sie den Inhalt als \`<script type="application/ld+json">...</script>\` in den \`<head>\` jeder Seite ein.
3. Prüfen Sie, dass die Dateien oeffentlich erreichbar sind (z.B. \`curl https://${new URL(opts.scanUrl).hostname}/llms.txt\`).
`;
		}
	})();

	const footer = `
## Validierung

Nach der Installation empfehlen wir einen Re-Scan in Beacon, um die Verbesserungen
zu verifizieren. Der neue AI-Readiness-Score sollte innerhalb von 15 Minuten
sichtbar sein.
`;

	return header + fileList + cmsSection + footer;
}
