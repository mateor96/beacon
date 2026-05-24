import type { AllQueueMetrics } from "@beacon/queue";
import { EmptyHint, SectionCard, StatusBadge } from "./primitives";

const BACKLOG_THRESHOLD = 100;

/**
 * Per-queue BullMQ job counts (read in-process). Highlights backlog
 * (waiting > 100) and any failed jobs. Degrades to a hint when Redis is
 * unreachable.
 */
export function QueueHealthPanel({ metrics }: { metrics: AllQueueMetrics | null }) {
	return (
		<SectionCard title="Queue-Health" description="Job-Zähler je BullMQ-Queue (live aus Redis).">
			{metrics === null ? (
				<EmptyHint>Queue-Metriken nicht verfügbar — Redis nicht erreichbar.</EmptyHint>
			) : (
				<>
					{metrics.partial ? (
						<div className="mb-3 rounded-md bg-danger/10 p-3 text-sm text-danger">
							Einige Queues konnten nicht gelesen werden.
						</div>
					) : null}
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full text-sm">
							<thead className="bg-surface-alt text-left text-text-muted">
								<tr>
									<th scope="col" className="px-3 py-2 font-medium">
										Queue
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Wartend
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Aktiv
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Fehlgeschlagen
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Verzögert
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Status
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border bg-white">
								{metrics.queues.map((q) => {
									const backlog = q.counts.waiting > BACKLOG_THRESHOLD;
									const hasFailed = q.counts.failed > 0;
									return (
										<tr key={q.name}>
											<td className="px-3 py-2 font-mono text-xs text-text">{q.name}</td>
											<td
												className={`px-3 py-2 text-right ${backlog ? "font-semibold text-danger" : "text-text"}`}
											>
												{q.counts.waiting}
											</td>
											<td className="px-3 py-2 text-right text-text">{q.counts.active}</td>
											<td
												className={`px-3 py-2 text-right ${hasFailed ? "font-semibold text-danger" : "text-text"}`}
											>
												{q.counts.failed}
											</td>
											<td className="px-3 py-2 text-right text-text">{q.counts.delayed}</td>
											<td className="px-3 py-2 text-right">
												{q.error ? (
													<StatusBadge tone="danger">Fehler</StatusBadge>
												) : backlog || hasFailed ? (
													<StatusBadge tone="danger">Achtung</StatusBadge>
												) : (
													<StatusBadge tone="success">OK</StatusBadge>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
					<p className="mt-2 text-xs text-text-muted">
						Stand: {new Date(metrics.collectedAt).toLocaleString("de-DE")}
					</p>
				</>
			)}
		</SectionCard>
	);
}
