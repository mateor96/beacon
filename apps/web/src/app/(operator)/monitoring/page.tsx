import { db, monitoringQueries } from "@beacon/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Monitoring",
	robots: { index: false, follow: false },
};

export default async function MonitoringIndexPage() {
	const projects = await monitoringQueries.listAllProjects(db);

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<div className="mb-8 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-text">Monitoring</h1>
					<p className="mt-2 text-text-muted">
						Instance-weite Projekte für AI-Visibility-Tracking. Wer Zugriff auf diese Beacon-Instanz
						hat, sieht und verändert alle Projekte.
					</p>
				</div>
				<Link
					href="/monitoring/new"
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Neues Projekt
				</Link>
			</div>

			{projects.length === 0 ? (
				<div className="rounded-lg border border-border bg-surface p-12 text-center">
					<p className="text-text-muted">
						Noch keine Monitoring-Projekte. Lege das erste an, um zu sehen wie deine Brand in
						ChatGPT, Claude, Perplexity und Gemini erwähnt wird.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface text-left text-text-muted">
							<tr>
								<th className="px-4 py-3 font-medium">Name</th>
								<th className="px-4 py-3 font-medium">Website</th>
								<th className="px-4 py-3 font-medium">Brand-Keywords</th>
								<th className="px-4 py-3 font-medium">Angelegt</th>
								<th className="px-4 py-3" />
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{projects.map((p) => (
								<tr key={p.id} className="hover:bg-surface/50">
									<td className="px-4 py-3 font-medium text-text">{p.name}</td>
									<td className="px-4 py-3 text-text-muted">
										<a
											href={p.websiteUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="hover:text-primary"
										>
											{new URL(p.websiteUrl).hostname}
										</a>
									</td>
									<td className="px-4 py-3 text-text-muted">
										{p.brandKeywords.slice(0, 3).join(", ")}
										{p.brandKeywords.length > 3 && ` +${p.brandKeywords.length - 3}`}
									</td>
									<td className="px-4 py-3 text-text-muted">
										{p.createdAt ? new Date(p.createdAt).toLocaleDateString("de-DE") : "—"}
									</td>
									<td className="px-4 py-3 text-right">
										<Link
											href={`/monitoring/${p.id}`}
											className="text-sm text-primary hover:underline"
										>
											Details &rarr;
										</Link>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}
