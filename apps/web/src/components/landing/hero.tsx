interface HeroProps {
	children?: React.ReactNode;
}

export function Hero({ children }: HeroProps) {
	return (
		<section
			id="scan"
			className="bg-gradient-to-b from-primary-light to-surface px-4 py-20 sm:px-6 md:py-32 lg:px-8"
		>
			<div className="mx-auto max-w-4xl text-center">
				<p className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary">
					Kostenloser KI-Readiness-Check
				</p>

				<h1 className="mb-6 text-4xl font-extrabold leading-tight text-text md:text-5xl lg:text-6xl">
					Ist deine Website bereit
					<br />
					<span className="text-primary">für KI-Agenten?</span>
				</h1>

				<p className="mx-auto mb-10 max-w-2xl text-lg text-text-muted md:text-xl">
					Beacon prüft 10 Readiness-Kriterien, berechnet deinen Score und zeigt dir genau, was
					ChatGPT, Perplexity und Co. auf deiner Website finden — und was nicht.
				</p>

				{children}

				<p className="mt-6 text-sm text-text-muted">
					Kostenlos starten — 3 Scans/Monat ohne Anmeldung.
				</p>
			</div>
		</section>
	);
}
