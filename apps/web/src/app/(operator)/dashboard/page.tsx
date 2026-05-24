import Link from "next/link";

export const metadata = {
	title: "Dashboard",
};

export default function DashboardPage() {
	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Dashboard</h1>
			<p className="mt-2 text-text-muted">
				Operator-Übersicht für diese Beacon-Instanz. Wähle einen Bereich in der Navigation.
			</p>

			<div className="mt-8 grid gap-4 sm:grid-cols-2">
				<Link
					href="/monitoring"
					className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
				>
					<h2 className="font-semibold text-text">Monitoring</h2>
					<p className="mt-1 text-sm text-text-muted">
						AI-Visibility-Projekte verwalten und Snapshots ansehen.
					</p>
				</Link>
				<Link
					href="/status"
					className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
				>
					<h2 className="font-semibold text-text">Status &amp; Health</h2>
					<p className="mt-1 text-sm text-text-muted">
						Provider-Keys, Queue-Health und konfigurierte Features prüfen.
					</p>
				</Link>
			</div>

			<p className="mt-8 text-sm text-text-muted">
				Instanz-Kennzahlen folgen in einer späteren Ausbaustufe.
			</p>
		</main>
	);
}
