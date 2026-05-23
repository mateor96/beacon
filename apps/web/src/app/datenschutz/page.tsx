import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Datenschutzerklärung",
};

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME;
const operatorAddress = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS;
const operatorEmail = process.env.NEXT_PUBLIC_OPERATOR_EMAIL;

export default function DatenschutzPage() {
	const configured = operatorName && operatorAddress && operatorEmail;

	return (
		<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
			<h1 className="mb-8 text-3xl font-bold text-text">Datenschutzerklärung</h1>

			<div className="space-y-8 text-text-muted">
				{!configured && (
					<section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
						<p className="font-semibold">Hinweis für Betreiber</p>
						<p className="mt-2 text-sm">
							Diese Datenschutzerklärung ist eine generische Vorlage und enthält keine
							rechtsverbindliche Aussage. Der jeweilige Betreiber dieser Instanz ist verantwortlich,
							eine vollständige, lokal geprüfte Datenschutzerklärung bereitzustellen. Setze
							mindestens <code>NEXT_PUBLIC_OPERATOR_NAME</code>,{" "}
							<code>NEXT_PUBLIC_OPERATOR_ADDRESS</code> und <code>NEXT_PUBLIC_OPERATOR_EMAIL</code>,
							um die Kontaktangaben zu füllen.
						</p>
					</section>
				)}

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">1. Verantwortlicher</h2>
					<p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
					<p className="mt-2">
						{operatorName ?? "[Name / Firma — vom Betreiber zu ergänzen]"}
						<br />
						{operatorAddress ?? "[Adresse — vom Betreiber zu ergänzen]"}
						<br />
						E-Mail: {operatorEmail ?? "[E-Mail — vom Betreiber zu ergänzen]"}
					</p>
				</section>

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">2. Erhobene Daten</h2>
					<p>
						Bei der Nutzung des Scan-Services speichern wir die gescannte URL sowie die
						Scan-Ergebnisse und ggf. generierte Fixes. Es werden keine personenbezogenen Konten
						geführt — die Nutzung erfolgt anonym.
					</p>
					<p className="mt-2">
						<strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)
						bei anonymen Scans.
					</p>
				</section>

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">3. Hosting</h2>
					<p>
						Hosting-Anbieter und -Standort hängen vom jeweiligen Betreiber dieser Instanz ab und
						sind von ihm zu dokumentieren.
					</p>
				</section>

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">4. Cookies</h2>
					<p>
						Diese Anwendung setzt in der Standardkonfiguration keine Tracking- oder
						Marketing-Cookies ein.
					</p>
				</section>

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">5. Ihre Rechte</h2>
					<p>Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:</p>
					<ul className="mt-2 list-inside list-disc space-y-1">
						<li>
							<strong>Auskunft</strong> (Art. 15 DSGVO)
						</li>
						<li>
							<strong>Berichtigung</strong> (Art. 16 DSGVO)
						</li>
						<li>
							<strong>Löschung</strong> (Art. 17 DSGVO)
						</li>
						<li>
							<strong>Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)
						</li>
						<li>
							<strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO)
						</li>
						<li>
							<strong>Widerspruch</strong> (Art. 21 DSGVO)
						</li>
					</ul>
					<p className="mt-2">
						Zur Ausübung Ihrer Rechte wenden Sie sich bitte an{" "}
						{operatorEmail ?? "[E-Mail — vom Betreiber zu ergänzen]"}.
					</p>
				</section>

				<section>
					<h2 className="mb-3 text-xl font-semibold text-text">6. Beschwerderecht</h2>
					<p>
						Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung
						Ihrer personenbezogenen Daten zu beschweren.
					</p>
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
