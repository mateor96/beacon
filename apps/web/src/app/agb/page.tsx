import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Allgemeine Geschäftsbedingungen (AGB)",
};

export default function AgbPage() {
	return (
		<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
			<h1 className="mb-8 text-3xl font-bold text-text">Allgemeine Geschäftsbedingungen (AGB)</h1>

			<div className="prose prose-slate max-w-none space-y-6 text-text-muted">
				<section>
					<h2 className="text-xl font-semibold text-text">§ 1 Geltungsbereich</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 2 Vertragsgegenstand</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 3 Registrierung und Nutzerkonto</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 4 Leistungsbeschreibung</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 5 Preise und Zahlung</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 6 Kündigung</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 7 Haftung</h2>
					<p>[Platzhalter]</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">§ 8 Schlussbestimmungen</h2>
					<p>[Platzhalter]</p>
				</section>
			</div>

			<div className="mt-12">
				<a href="/" className="text-sm text-primary hover:underline">
					&larr; Zurück zur Startseite
				</a>
			</div>
		</main>
	);
}
