import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Impressum",
};

const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME;
const operatorAddress = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS;
const operatorEmail = process.env.NEXT_PUBLIC_OPERATOR_EMAIL;
const operatorPhone = process.env.NEXT_PUBLIC_OPERATOR_PHONE;

export default function ImpressumPage() {
	const configured = operatorName && operatorAddress && operatorEmail;

	return (
		<main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
			<h1 className="mb-8 text-3xl font-bold text-text">Impressum</h1>

			<div className="prose prose-slate max-w-none space-y-6 text-text-muted">
				{!configured && (
					<section className="rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-900">
						<p className="font-semibold">Hinweis für Betreiber</p>
						<p className="mt-2 text-sm">
							Diese Seite wird vom jeweiligen Betreiber dieser Instanz bereitgestellt. Setze{" "}
							<code>NEXT_PUBLIC_OPERATOR_NAME</code>, <code>NEXT_PUBLIC_OPERATOR_ADDRESS</code>,{" "}
							<code>NEXT_PUBLIC_OPERATOR_EMAIL</code> und optional{" "}
							<code>NEXT_PUBLIC_OPERATOR_PHONE</code>, um die rechtlich notwendigen Angaben
							einzublenden.
						</p>
					</section>
				)}

				<section>
					<h2 className="text-xl font-semibold text-text">Angaben gemäß § 5 TMG</h2>
					<p>
						{operatorName ?? "[Name / Firma — vom Betreiber zu ergänzen]"}
						<br />
						{operatorAddress ?? "[Adresse — vom Betreiber zu ergänzen]"}
					</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">Kontakt</h2>
					<p>
						E-Mail: {operatorEmail ?? "[E-Mail — vom Betreiber zu ergänzen]"}
						{operatorPhone && (
							<>
								<br />
								Telefon: {operatorPhone}
							</>
						)}
					</p>
				</section>

				<section>
					<h2 className="text-xl font-semibold text-text">EU-Streitschlichtung</h2>
					<p>
						Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
						<a
							href="https://ec.europa.eu/consumers/odr/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							https://ec.europa.eu/consumers/odr/
						</a>
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
