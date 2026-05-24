import { NewMonitoringProjectForm } from "@/components/monitoring/new-project-form";

export const metadata = {
	title: "Neues Monitoring-Projekt",
	robots: { index: false, follow: false },
};

export default function NewMonitoringProjectPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Neues Monitoring-Projekt</h1>
			<p className="mt-2 text-text-muted">
				Eine Brand + Website registrieren. Beacon fragt anschließend periodisch ChatGPT, Claude,
				Perplexity und Gemini, ob deine Brand erwähnt wird, in welchem Kontext, und ob deine eigene
				URL als Quelle zitiert wird.
			</p>

			<div className="mt-8">
				<NewMonitoringProjectForm />
			</div>
		</main>
	);
}
