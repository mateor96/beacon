import Link from "next/link";

export default function AuditLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-surface">
			<nav className="border-b border-border bg-surface">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
					<Link href="/" className="text-lg font-bold text-primary">
						Beacon
					</Link>
					<div className="flex items-center gap-3">
						<Link href="/" className="text-sm text-text-muted transition-colors hover:text-text">
							Neue Analyse
						</Link>
						<Link
							href="/signup"
							className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
						>
							Kostenlos registrieren
						</Link>
					</div>
				</div>
			</nav>
			<main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
		</div>
	);
}
