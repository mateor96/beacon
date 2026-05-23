import { SectionWrapper } from "./section-wrapper";

const steps = [
	{
		step: "1",
		title: "URL eingeben",
		description:
			"Gib die URL deiner Website ein. Beacon startet sofort den Scan — 10 Checks in unter 30 Sekunden.",
	},
	{
		step: "2",
		title: "Score & Issues erhalten",
		description:
			"Readiness-Score von 0-100 mit Level-Einordnung (0-3). Jedes Issue wird mit Schweregrad und Erklärung angezeigt.",
	},
	{
		step: "3",
		title: "Fixes herunterladen",
		description:
			"Beacon generiert automatisch die Lösungen: fertige llms.txt, optimiertes JSON-LD, angepasste robots.txt und mehr.",
	},
];

export function Solution() {
	return (
		<SectionWrapper id="loesung" className="bg-surface-alt">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">
					Die Lösung: 3 Schritte zur AI-Readiness
				</h2>
				<p className="mx-auto max-w-2xl text-lg text-text-muted">
					Beacon ist das Lighthouse für die KI-Ära. Analyse, Diagnose und Fix-Generierung in einem
					Tool.
				</p>
			</div>

			<div className="grid gap-8 md:grid-cols-3">
				{steps.map((item) => (
					<div key={item.step} className="text-center">
						<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-text-inverse">
							{item.step}
						</div>
						<h3 className="mb-2 text-lg font-semibold text-text">{item.title}</h3>
						<p className="text-text-muted">{item.description}</p>
					</div>
				))}
			</div>
		</SectionWrapper>
	);
}
