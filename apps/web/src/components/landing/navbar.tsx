export function Navbar() {
	return (
		<header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm">
			<nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
				<a href="/" className="text-xl font-bold text-primary">
					Beacon
				</a>

				<ul className="hidden items-center gap-6 text-sm font-medium md:flex">
					<li>
						<a href="#problem" className="text-text-muted transition-colors hover:text-text">
							Problem
						</a>
					</li>
					<li>
						<a href="#loesung" className="text-text-muted transition-colors hover:text-text">
							Lösung
						</a>
					</li>
					<li>
						<a href="#features" className="text-text-muted transition-colors hover:text-text">
							Features
						</a>
					</li>
					<li>
						<a href="/pricing" className="text-text-muted transition-colors hover:text-text">
							Pricing
						</a>
					</li>
					<li>
						<a href="#faq" className="text-text-muted transition-colors hover:text-text">
							FAQ
						</a>
					</li>
				</ul>

				<div className="flex items-center gap-3">
					<a
						href="/login"
						className="text-sm font-medium text-text-muted transition-colors hover:text-text"
					>
						Anmelden
					</a>
					<a
						href="#scan"
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
					>
						Website scannen
					</a>
				</div>
			</nav>
		</header>
	);
}
