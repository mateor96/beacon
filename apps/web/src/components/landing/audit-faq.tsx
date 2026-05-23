import { SectionWrapper } from "./section-wrapper";

const faqs = [
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

export function AuditFaq() {
	return (
		<SectionWrapper id="audit-faq">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">
					Häufige Fragen zum KI-Sichtbarkeit-Check
				</h2>
			</div>

			<div className="mx-auto max-w-3xl space-y-3">
				{faqs.map((faq) => (
					<details key={faq.question} className="group rounded-lg border border-border bg-surface">
						<summary className="cursor-pointer px-6 py-4 text-left font-medium text-text transition-colors hover:text-primary">
							{faq.question}
						</summary>
						<div className="px-6 pb-4 text-text-muted">{faq.answer}</div>
					</details>
				))}
			</div>
		</SectionWrapper>
	);
}
