const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const faqItems = [
	{
		question: "Was prüft der kostenlose KI-Sichtbarkeit-Check?",
		answer:
			"Der Check analysiert deine Website anhand von 10 KI-Readiness-Kriterien — darunter llms.txt, Schema.org/JSON-LD, robots.txt für KI-Crawler, Meta-Tags, Content-Struktur und mehr. Du erhältst einen Score von 0-100 mit konkreten Verbesserungsvorschlägen.",
	},
	{
		question: "Ist der Check wirklich kostenlos?",
		answer:
			"Ja, der KI-Sichtbarkeit-Check ist 100% kostenlos und ohne Einschränkungen nutzbar. Keine Kreditkarte, kein Abo, keine versteckten Kosten.",
	},
	{
		question: "Wie lange dauert die Analyse?",
		answer:
			"Die komplette Analyse dauert weniger als 30 Sekunden. Du gibst einfach deine URL ein und erhältst sofort deinen KI-Readiness-Score mit allen Details.",
	},
	{
		question: "Was passiert mit meinen Daten?",
		answer:
			"Wir speichern nur die analysierten URLs und Ergebnisse — gehostet auf EU-Servern (Hetzner, Deutschland). Keine Daten werden an Dritte weitergegeben. Vollständig DSGVO-konform.",
	},
	{
		question: "Muss ich mich registrieren?",
		answer:
			"Nein, für den kostenlosen Check ist keine Registrierung erforderlich. Einfach URL eingeben und Ergebnis erhalten.",
	},
	{
		question: "Was ist der Unterschied zum vollen Beacon-Scan?",
		answer:
			"Der kostenlose Check gibt dir einen Überblick über deine KI-Sichtbarkeit. Der volle Beacon-Scan bietet zusätzlich automatische Fix-Generierung, Multi-Page-Crawling, Monitoring, White-Label-Reports und API-Zugang.",
	},
];

function WebPageJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: "Kostenloser KI-Sichtbarkeit-Check — Beacon",
		description:
			"Prüfe in unter 30 Sekunden, wie gut deine Website für KI-Agenten sichtbar ist. 10 Checks, sofort Ergebnisse, 100% kostenlos.",
		url: `${SITE_URL}/audit`,
		inLanguage: "de",
	};

	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: standard pattern for JSON-LD
		<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
	);
}

function FaqPageJsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqItems.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};

	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: standard pattern for JSON-LD
		<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
	);
}

export function AuditJsonLd() {
	return (
		<>
			<WebPageJsonLd />
			<FaqPageJsonLd />
		</>
	);
}
