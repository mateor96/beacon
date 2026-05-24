import { CrawlTrigger } from "@/components/monitoring/crawl-trigger";
import { RoiReportTrigger } from "@/components/monitoring/roi-report-trigger";
import { ScheduleManager, type ScheduleView } from "@/components/monitoring/schedule-manager";
import { SweepTrigger } from "@/components/monitoring/sweep-trigger";
import { createConfiguredProviders } from "@beacon/ai";
import { aiVisibilityQueries, crawlQueries, db, monitoringQueries, roiQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
	robots: { index: false, follow: false },
};

interface Props {
	params: Promise<{ id: string }>;
}

export default async function MonitoringProjectDetailPage({ params }: Props) {
	const { id } = await params;
	const idCheck = UuidSchema.safeParse(id);
	if (!idCheck.success) notFound();

	const project = await monitoringQueries.getProjectById(db, id);
	if (!project) notFound();

	const snapshots = await aiVisibilityQueries.getSnapshotsByProjectId(db, id, { limit: 20 });
	const roiReports = await roiQueries.getReportsForProject(db, id);
	const crawls = await crawlQueries.listForProject(db, id, { limit: 5 });
	const schedules = await monitoringQueries.getSchedulesByProjectId(db, id);

	const providersConfigured = createConfiguredProviders().length > 0;
	const scheduleViews: ScheduleView[] = schedules.map((s) => ({
		id: s.id,
		frequency: s.frequency,
		nextRunAt: s.nextRunAt.toISOString(),
		lastRunAt: s.lastRunAt?.toISOString() ?? null,
		enabled: s.enabled,
	}));

	return (
		<>
			<section className="mb-8 grid gap-4 sm:grid-cols-2">
				<div className="rounded-lg border border-border bg-surface p-4">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Brand-Keywords
					</h2>
					<ul className="mt-2 flex flex-wrap gap-2">
						{project.brandKeywords.map((k) => (
							<li key={k} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
								{k}
							</li>
						))}
					</ul>
				</div>
				<div className="rounded-lg border border-border bg-surface p-4">
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Wettbewerber
					</h2>
					{project.competitorKeywords && project.competitorKeywords.length > 0 ? (
						<ul className="mt-2 flex flex-wrap gap-2">
							{project.competitorKeywords.map((k) => (
								<li key={k} className="rounded-full bg-border/40 px-3 py-1 text-sm text-text-muted">
									{k}
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 text-sm text-text-muted">Keine Wettbewerber registriert.</p>
					)}
				</div>
			</section>

			<section className="mb-8">
				<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
					<h2 className="text-xl font-semibold text-text">ROI-Reports</h2>
					<RoiReportTrigger projectId={id} />
				</div>
				{roiReports.length === 0 ? (
					<p className="rounded-lg border border-border bg-surface p-6 text-text-muted">
						Noch keine ROI-Reports. Klicke "Report erstellen" oben — der Worker rendert das PDF im
						Hintergrund.
					</p>
				) : (
					<ul className="divide-y divide-border rounded-lg border border-border bg-white">
						{roiReports.map((r) => (
							<li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
								<div>
									<div className="font-medium text-text">
										{new Date(r.createdAt).toLocaleString("de-DE")}
									</div>
									<div className="text-xs text-text-muted">
										Format: {r.format} · ID {r.id.slice(0, 8)}
									</div>
								</div>
								<a
									href={`/api/monitoring/projects/${id}/roi-report/${r.id}?format=pdf`}
									className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text transition-colors hover:bg-primary hover:text-text-inverse"
								>
									PDF herunterladen
								</a>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="mb-8">
				<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
					<h2 className="text-xl font-semibold text-text">Site-Crawls</h2>
					<CrawlTrigger projectId={id} />
				</div>
				{crawls.length === 0 ? (
					<p className="rounded-lg border border-border bg-surface p-6 text-text-muted">
						Noch kein Crawl. Klicke "Site crawlen" oben — der Crawler entdeckt bis zu 200
						Unterseiten (max. 3 Ebenen tief, respektiert robots.txt).
					</p>
				) : (
					<ul className="divide-y divide-border rounded-lg border border-border bg-white">
						{crawls.map((c) => (
							<li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
								<div>
									<div className="font-medium text-text">{c.rootUrl}</div>
									<div className="text-xs text-text-muted">
										{c.startedAt ? new Date(c.startedAt).toLocaleString("de-DE") : "—"} · Pages:{" "}
										{c.pagesScanned ?? 0}/{c.pagesFound ?? 0}
									</div>
								</div>
								<span
									className={`rounded-full px-3 py-1 text-xs font-medium ${
										c.status === "completed"
											? "bg-success/10 text-success"
											: c.status === "failed"
												? "bg-danger/10 text-danger"
												: "bg-border/40 text-text-muted"
									}`}
								>
									{c.status}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="mb-8">
				<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
					<h2 className="text-xl font-semibold text-text">Zeitpläne</h2>
				</div>
				<p className="mb-3 text-xs text-text-muted">
					Hinweis: Zeitpläne werden gespeichert, aber noch nicht automatisch ausgeführt — der
					AI-Visibility-Sweep läuft aktuell global täglich. Ein Zeitplan-Dispatcher folgt.
				</p>
				<ScheduleManager projectId={id} schedules={scheduleViews} />
			</section>

			<section>
				<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
					<h2 className="text-xl font-semibold text-text">Letzte Snapshots</h2>
					<SweepTrigger projectId={id} disabled={!providersConfigured} />
				</div>
				{snapshots.length === 0 ? (
					<p className="rounded-lg border border-border bg-surface p-6 text-text-muted">
						Noch keine Snapshots. Der erste AI-Visibility-Job läuft im Hintergrund.
						{!providersConfigured
							? " Hinweis: Es ist kein AI-Provider konfiguriert — siehe Status & Health."
							: ""}
					</p>
				) : (
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full text-sm">
							<thead className="bg-surface text-left text-text-muted">
								<tr>
									<th className="px-4 py-2 font-medium">Engine</th>
									<th className="px-4 py-2 font-medium">Brand</th>
									<th className="px-4 py-2 font-medium">Query</th>
									<th className="px-4 py-2 font-medium">Wann</th>
									<th className="px-4 py-2 text-right font-medium">Kosten</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border bg-white">
								{snapshots.map((s) => (
									<tr key={s.id}>
										<td className="px-4 py-2 font-medium text-text">{s.aiEngine}</td>
										<td className="px-4 py-2 text-text-muted">{s.brandName}</td>
										<td className="px-4 py-2 text-text-muted">
											<span className="line-clamp-1">{s.queryText}</span>
										</td>
										<td className="px-4 py-2 text-text-muted">
											{new Date(s.queriedAt).toLocaleString("de-DE")}
										</td>
										<td className="px-4 py-2 text-right text-text-muted">
											{s.costCents != null ? `${(s.costCents / 100).toFixed(3)} $` : "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</>
	);
}
