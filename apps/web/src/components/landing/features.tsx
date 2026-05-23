import { SectionWrapper } from "./section-wrapper";

const checks = [
	{
		name: "llms.txt",
		description: "Prüft ob eine llms.txt-Datei vorhanden und korrekt strukturiert ist.",
	},
	{
		name: "robots.txt",
		description: "Überprüft ob KI-Crawler (GPTBot, ClaudeBot, PerplexityBot) erlaubt sind.",
	},
	{
		name: "Schema.org / JSON-LD",
		description: "Analysiert strukturierte Daten im HTML auf Vollständigkeit und Tiefe.",
	},
	{
		name: "Meta-Tags & Open Graph",
		description: "Prüft Titel, Beschreibung, OG-Tags und Social-Media-Metadaten.",
	},
	{
		name: "Content-Struktur",
		description: "Bewertet Überschriften-Hierarchie, Absatzqualität und Answer-First-Format.",
	},
	{
		name: "Semantische Qualität",
		description: "Hybrid-Check: Heuristik (kostenlos) + KI-Analyse (Pro) für Textqualität.",
	},
	{
		name: "WebMCP-Readiness",
		description: "Prüft ob Formulare WebMCP-Attribute für KI-Agent-Interaktion haben.",
	},
	{
		name: "AGENTS.md",
		description: "Überprüft ob eine AGENTS.md-Datei mit Agent-Verhaltensregeln existiert.",
	},
	{
		name: "Citation-Readiness",
		description: "8 Sub-Signale für Zitierfähigkeit: Autorenschaft, Datum, Schema-Tiefe, etc.",
	},
	{
		name: "Performance & Crawlability",
		description: "Misst Antwortzeiten, prüft Redirects, Fehler und JS-Rendering.",
	},
];

export function Features() {
	return (
		<SectionWrapper id="features">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">
					10 Checks für volle AI-Readiness
				</h2>
				<p className="mx-auto max-w-2xl text-lg text-text-muted">
					Beacon prüft alle relevanten Signale — von den Basics (llms.txt, robots.txt) bis zu den
					neuen Standards (WebMCP, AGENTS.md).
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				{checks.map((check) => (
					<div
						key={check.name}
						className="rounded-lg border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
					>
						<h3 className="mb-1 text-sm font-semibold text-primary">{check.name}</h3>
						<p className="text-xs text-text-muted">{check.description}</p>
					</div>
				))}
			</div>
		</SectionWrapper>
	);
}
