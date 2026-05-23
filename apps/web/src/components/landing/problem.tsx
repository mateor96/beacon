import { SectionWrapper } from "./section-wrapper";

const problems = [
	{
		icon: "M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.774 4.774zM21 12a9 9 0 11-18 0 9 9 0 0118 0z",
		title: "Unsichtbar für KI",
		description:
			"ChatGPT, Perplexity und Co. können deine Website nicht finden oder verstehen. Ohne llms.txt, Schema.org und strukturierten Content existierst du für KI-Agenten nicht.",
	},
	{
		icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z",
		title: "Keine strukturierte Antwort",
		description:
			'Kunden fragen: "Findet ChatGPT unser Unternehmen?" — und Agenturen haben keine Antwort. Es fehlt an Tools und Know-how für AI-Readiness.',
	},
	{
		icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
		title: "Manuelle Analyse skaliert nicht",
		description:
			"Eine Website manuell auf AI-Readiness zu prüfen dauert 30-60 Minuten. Bei 10+ Kunden-Websites ist das nicht tragbar.",
	},
];

export function Problem() {
	return (
		<SectionWrapper id="problem">
			<div className="mb-12 text-center">
				<h2 className="mb-4 text-3xl font-bold text-text md:text-4xl">Das Problem</h2>
				<p className="mx-auto max-w-2xl text-lg text-text-muted">
					Die neue Suche funktioniert anders. KI-Agenten ersetzen Google — aber fast keine Website
					ist darauf vorbereitet.
				</p>
			</div>

			<div className="grid gap-8 md:grid-cols-3">
				{problems.map((problem) => (
					<div
						key={problem.title}
						className="rounded-xl border border-border bg-surface p-6 shadow-sm"
					>
						<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								strokeWidth={1.5}
								stroke="currentColor"
								className="h-6 w-6 text-danger"
								aria-hidden="true"
							>
								<title>Problem-Icon</title>
								<path strokeLinecap="round" strokeLinejoin="round" d={problem.icon} />
							</svg>
						</div>
						<h3 className="mb-2 text-lg font-semibold text-text">{problem.title}</h3>
						<p className="text-text-muted">{problem.description}</p>
					</div>
				))}
			</div>
		</SectionWrapper>
	);
}
