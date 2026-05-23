import { SectionWrapper } from "./section-wrapper";

const steps = [
	{
		step: "1",
		title: "URL eingeben",
		description: "Gib deine Website-URL ein — kein Login noetig.",
	},
	{
		step: "2",
		title: "KI-Analyse läuft",
		description: "Beacon prüft 10 KI-Readiness-Kriterien in unter 30 Sekunden.",
	},
	{
		step: "3",
		title: "Ergebnis erhalten",
		description: "Score, Issues und Verbesserungsvorschlaege — sofort und kostenlos.",
	},
];

export function HowItWorks() {
	return (
		<SectionWrapper id="how-it-works" className="bg-surface-alt">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">So funktioniert's</h2>
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
