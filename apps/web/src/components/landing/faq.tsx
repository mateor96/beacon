import { SectionWrapper } from "./section-wrapper";

const faqs = [
	{
		question: "Was genau ist Agentic Web Readiness?",
		answer:
			"Agentic Web Readiness beschreibt, wie gut eine Website für die Interaktion mit KI-Agenten (ChatGPT, Perplexity, Claude, Gemini etc.) vorbereitet ist. Beacon prüft 10 Kriterien und gibt einen Score von 0-100.",
	},
	{
		question: "Wie unterscheidet sich Beacon von SEO-Tools?",
		answer:
			"SEO-Tools optimieren für Google-Rankings. Beacon optimiert für KI-Sichtbarkeit — also dafür, dass KI-Agenten deine Website finden, verstehen und zitieren. Das erfordert andere Standards wie llms.txt, Schema.org-Tiefe und WebMCP.",
	},
	{
		question: "Was bedeutet Fix-Generierung?",
		answer:
			"Beacon zeigt nicht nur Probleme, sondern generiert automatisch die Lösungen: Eine fertige llms.txt-Datei, optimiertes JSON-LD-Markup, angepasste robots.txt-Vorschläge und mehr — alles zum Download bereit.",
	},
	{
		question: "Für wen ist Beacon gedacht?",
		answer:
			"Beacon ist primär für Webdesign-Agenturen, SEO-Agenturen und Freelance-Webentwickler im DACH-Raum gebaut. Aber auch Unternehmen, die ihre KI-Sichtbarkeit selbst verbessern wollen, profitieren vom Free-Tier.",
	},
	{
		question: "Was sind White-Label Reports?",
		answer:
			"Im Agency-Tier können Sie PDF-Reports mit Ihrem eigenen Agentur-Logo und -Branding erstellen. So präsentieren Sie die Ergebnisse Ihren Kunden professionell — ohne dass Beacon als Tool sichtbar ist.",
	},
	{
		question: "Welche KI-Standards prüft Beacon?",
		answer:
			"Beacon prüft llms.txt, robots.txt (KI-Crawler), Schema.org/JSON-LD, Meta-Tags, Content-Struktur, Semantische Qualität, WebMCP-Readiness, AGENTS.md, Citation-Readiness und Performance/Crawlability.",
	},
	{
		question: "Ist Beacon DSGVO-konform?",
		answer:
			"Ja. Beacon wird auf EU-Servern gehostet (Hetzner, Deutschland). Wir speichern nur die Daten, die für den Service notwendig sind. Double-Opt-In für die Warteliste. Keine Daten werden an Dritte weitergegeben.",
	},
];

export function Faq() {
	return (
		<SectionWrapper id="faq">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">Häufige Fragen</h2>
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
