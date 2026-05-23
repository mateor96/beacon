export function Footer() {
	const year = new Date().getFullYear();

	return (
		<footer className="border-t border-border bg-surface px-4 py-8 sm:px-6 lg:px-8">
			<div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
				<p className="text-sm text-text-muted">
					&copy; {year} Beacon — Agentic Web Readiness. Alle Rechte vorbehalten.
				</p>

				<nav>
					<ul className="flex gap-6 text-sm text-text-muted">
						<li>
							<a href="/impressum" className="transition-colors hover:text-text">
								Impressum
							</a>
						</li>
						<li>
							<a href="/datenschutz" className="transition-colors hover:text-text">
								Datenschutz
							</a>
						</li>
					</ul>
				</nav>
			</div>
		</footer>
	);
}
