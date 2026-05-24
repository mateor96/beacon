import type { CronHealthEntry } from "@/lib/worker-client";
import { EmptyHint, SectionCard, StatusBadge } from "./primitives";

/**
 * Cron-job last/next-run state. This is the only worker-process-only datum on
 * the status page; `entries === null` means `WORKER_INTERNAL_URL` is unset or
 * the worker was unreachable (degraded, not an error).
 */
export function CronHealthPanel({ entries }: { entries: CronHealthEntry[] | null }) {
	return (
		<SectionCard title="Cron-Jobs" description="Geplante Worker-Läufe und ihr letzter Status.">
			{entries === null ? (
				<EmptyHint>
					Worker-Status nicht verfügbar. Setze <code>WORKER_INTERNAL_URL</code> und stelle sicher,
					dass der Worker läuft.
				</EmptyHint>
			) : entries.length === 0 ? (
				<EmptyHint>Keine Cron-Jobs registriert.</EmptyHint>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface-alt text-left text-text-muted">
							<tr>
								<th scope="col" className="px-3 py-2 font-medium">
									Job
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Zeitplan
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Letzter Lauf
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Nächster Lauf
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{entries.map((e) => (
								<tr key={e.name}>
									<td className="px-3 py-2 font-mono text-xs text-text">{e.name}</td>
									<td className="px-3 py-2 font-mono text-xs text-text-muted">{e.pattern}</td>
									<td className="px-3 py-2 text-xs text-text-muted">
										{e.lastRun ? new Date(e.lastRun).toLocaleString("de-DE") : "—"}
									</td>
									<td className="px-3 py-2 text-xs text-text-muted">
										{e.nextRun ? new Date(e.nextRun).toLocaleString("de-DE") : "—"}
									</td>
									<td className="px-3 py-2">
										{e.lastStatus === "success" ? (
											<StatusBadge tone="success">OK</StatusBadge>
										) : e.lastStatus === "failure" ? (
											<StatusBadge tone="danger">Fehler</StatusBadge>
										) : (
											<StatusBadge tone="muted">—</StatusBadge>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</SectionCard>
	);
}
