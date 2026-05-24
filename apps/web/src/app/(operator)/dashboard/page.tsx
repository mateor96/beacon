import { createConfiguredProviders } from "@beacon/ai";
import { citationQueries, db, monitoringQueries } from "@beacon/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Dashboard",
};

export default async function DashboardPage() {
	const [projects, citationStats] = await Promise.all([
		monitoringQueries.listAllProjects(db),
		citationQueries.getCitationStatsForInstance(db),
	]);
	const providerCount = createConfiguredProviders().length;

	const kpis = [
		{ label: "Monitoring-Projekte", value: projects.length, href: "/monitoring" },
		{ label: "Citations gesamt", value: citationStats.total, href: "/citations" },
		{ label: "Aktive AI-Provider", value: providerCount, href: "/status" },
	];

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Dashboard</h1>
			<p className="mt-2 text-text-muted">Überblick über diese Beacon-Instanz.</p>

			{providerCount === 0 && (
				<div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
					Kein AI-Provider konfiguriert — AI-Visibility-Sweeps sind deaktiviert. Setze einen
					Provider-Key (siehe{" "}
					<Link href="/status" className="font-medium underline">
						Status &amp; Health
					</Link>
					).
				</div>
			)}

			<div className="mt-8 grid gap-4 sm:grid-cols-3">
				{kpis.map((k) => (
					<Link
						key={k.label}
						href={k.href}
						className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
					>
						<p className="text-xs uppercase tracking-wide text-text-muted">{k.label}</p>
						<p className="mt-1 text-3xl font-bold text-text">{k.value}</p>
					</Link>
				))}
			</div>

			<div className="mt-8 grid gap-4 sm:grid-cols-2">
				<Link
					href="/monitoring"
					className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
				>
					<h2 className="font-semibold text-text">Monitoring</h2>
					<p className="mt-1 text-sm text-text-muted">
						AI-Visibility-Projekte verwalten, Sweeps starten und Snapshots ansehen.
					</p>
				</Link>
				<Link
					href="/status"
					className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary"
				>
					<h2 className="font-semibold text-text">Status &amp; Health</h2>
					<p className="mt-1 text-sm text-text-muted">
						Provider-Keys, Queue-Health, Dead-Letter-Queue und E-Mail-Log prüfen.
					</p>
				</Link>
			</div>
		</main>
	);
}
