interface AuditHeroProps {
	children?: React.ReactNode;
}

export function AuditHero({ children }: AuditHeroProps) {
	return (
		<section
			id="audit"
			className="bg-gradient-to-b from-primary-light to-surface px-4 py-20 sm:px-6 md:py-32 lg:px-8"
		>
			<div className="mx-auto max-w-4xl text-center">
				<p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
					Kostenloser KI-Sichtbarkeit-Check
				</p>

				<h1 className="mb-6 text-4xl font-extrabold leading-tight text-text md:text-5xl lg:text-6xl">
					Ist deine Website sichtbar
					<br />
					<span className="text-primary">für KI-Agenten?</span>
				</h1>

				<p className="mx-auto mb-10 max-w-2xl text-lg text-text-muted md:text-xl">
					Prüfe in 30 Sekunden ob ChatGPT, Perplexity und Claude deine Website finden — kostenlos
					und ohne Anmeldung.
				</p>

				{children}

				<p className="mt-6 text-sm text-text-muted">
					Kostenlos. Keine Anmeldung. Sofort Ergebnisse.
				</p>
			</div>
		</section>
	);
}
