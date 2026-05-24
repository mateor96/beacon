import Link from "next/link";

export interface CitationStats {
	total: number;
	byModel: { modelName: string; count: number }[];
	topPages: {
		clientPageId: string;
		url: string;
		domain: string | null;
		count: number;
		currentPeriodCount: number;
		priorPeriodCount: number;
	}[];
	topDomains: { domain: string | null; count: number }[];
	trend: { day: string; count: number }[];
}

export interface CitationRow {
	id: string;
	modelName: string;
	queryText: string;
	extractedAt: string;
}

function TrendArrow({ current, prior }: { current: number; prior: number }) {
	if (current > prior) return <span className="text-success">▲</span>;
	if (current < prior) return <span className="text-danger">▼</span>;
	return <span className="text-text-muted">→</span>;
}

const DAYS_OPTIONS = [30, 60, 90] as const;

export function CitationOverview({
	stats,
	recent,
	days,
}: {
	stats: CitationStats;
	recent: CitationRow[];
	days: 30 | 60 | 90;
}) {
	if (stats.total === 0) {
		return (
			<div className="rounded-lg border border-border bg-surface p-12 text-center">
				<p className="text-text-muted">
					Noch keine Citations erfasst. Citations entstehen, wenn AI-Engines deine gecrawlten Seiten
					in Antworten zitieren — starte einen Crawl und einen AI-Visibility-Sweep.
				</p>
			</div>
		);
	}

	const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count));

	return (
		<div className="space-y-6">
			{/* KPI row */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<div className="rounded-lg border border-border bg-surface p-4">
					<p className="text-xs uppercase tracking-wide text-text-muted">Citations gesamt</p>
					<p className="mt-1 text-2xl font-bold text-text">{stats.total}</p>
				</div>
				{stats.byModel.slice(0, 3).map((m) => (
					<div key={m.modelName} className="rounded-lg border border-border bg-surface p-4">
						<p className="truncate text-xs uppercase tracking-wide text-text-muted">
							{m.modelName}
						</p>
						<p className="mt-1 text-2xl font-bold text-text">{m.count}</p>
					</div>
				))}
			</div>

			{/* Trend */}
			<section className="rounded-lg border border-border bg-surface p-5">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<h2 className="text-lg font-semibold text-text">Verlauf ({days} Tage)</h2>
					<div className="flex gap-1 text-xs">
						{DAYS_OPTIONS.map((d) => (
							<Link
								key={d}
								href={`/citations?days=${d}`}
								className={`rounded-md px-2.5 py-1 ${
									d === days ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text"
								}`}
							>
								{d}T
							</Link>
						))}
					</div>
				</div>
				{stats.trend.length === 0 ? (
					<p className="text-sm text-text-muted">Keine Citations im gewählten Zeitraum.</p>
				) : (
					<div className="flex h-32 items-end gap-1">
						{stats.trend.map((t) => (
							<div
								key={t.day}
								className="flex flex-1 flex-col items-center justify-end"
								title={`${t.day}: ${t.count}`}
							>
								<div
									className="w-full rounded-t bg-primary"
									style={{ height: `${(t.count / maxTrend) * 100}%` }}
								/>
							</div>
						))}
					</div>
				)}
			</section>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Top pages */}
				<section className="rounded-lg border border-border bg-surface p-5">
					<h2 className="mb-3 text-lg font-semibold text-text">Top zitierte Seiten</h2>
					{stats.topPages.length === 0 ? (
						<p className="text-sm text-text-muted">Keine zugeordneten Seiten.</p>
					) : (
						<ul className="divide-y divide-border">
							{stats.topPages.map((p) => (
								<li key={p.clientPageId} className="flex items-center justify-between gap-3 py-2">
									<span className="min-w-0 truncate text-sm text-text" title={p.url}>
										{p.url}
									</span>
									<span className="flex shrink-0 items-center gap-2 text-sm text-text-muted">
										<TrendArrow current={p.currentPeriodCount} prior={p.priorPeriodCount} />
										{p.count}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>

				{/* Top domains */}
				<section className="rounded-lg border border-border bg-surface p-5">
					<h2 className="mb-3 text-lg font-semibold text-text">Top Domains</h2>
					{stats.topDomains.length === 0 ? (
						<p className="text-sm text-text-muted">Keine Domains erfasst.</p>
					) : (
						<ul className="divide-y divide-border">
							{stats.topDomains.map((d) => (
								<li key={d.domain ?? "unknown"} className="flex items-center justify-between py-2">
									<span className="truncate text-sm text-text">{d.domain ?? "—"}</span>
									<span className="text-sm text-text-muted">{d.count}</span>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>

			{/* Recent citations */}
			<section>
				<h2 className="mb-3 text-lg font-semibold text-text">Neueste Citations</h2>
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface text-left text-text-muted">
							<tr>
								<th scope="col" className="px-4 py-2 font-medium">
									Modell
								</th>
								<th scope="col" className="px-4 py-2 font-medium">
									Query
								</th>
								<th scope="col" className="px-4 py-2 font-medium">
									Wann
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{recent.map((c) => (
								<tr key={c.id}>
									<td className="px-4 py-2 font-medium text-text">{c.modelName}</td>
									<td className="px-4 py-2 text-text-muted">
										<span className="line-clamp-1">{c.queryText}</span>
									</td>
									<td className="px-4 py-2 text-text-muted">
										{new Date(c.extractedAt).toLocaleString("de-DE")}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
