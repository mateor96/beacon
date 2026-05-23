const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function OrganizationJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "Beacon — Agentic Web Readiness",
		url: SITE_URL,
		description:
			"SaaS-Tool für Agentic Web Readiness. Prüft ob Websites für KI-Agenten bereit sind und generiert automatisch Fixes.",
		foundingDate: "2026",
		areaServed: {
			"@type": "GeoCircle",
			geoMidpoint: {
				"@type": "GeoCoordinates",
				latitude: 48.2082,
				longitude: 16.3738,
			},
			description: "DACH-Raum (Deutschland, Österreich, Schweiz)",
		},
	};

	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: standard pattern for JSON-LD
		<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
	);
}

function WebSiteJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Beacon — Agentic Web Readiness",
		url: SITE_URL,
		description:
			"Lighthouse für Agentic Web Readiness. 10 Checks, automatische Fix-Generierung, White-Label Reports.",
		inLanguage: "de",
	};

	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: standard pattern for JSON-LD
		<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
	);
}

export function JsonLd() {
	return (
		<>
			<OrganizationJsonLd />
			<WebSiteJsonLd />
		</>
	);
}
