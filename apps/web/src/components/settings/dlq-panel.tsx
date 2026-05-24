import { EmptyHint, SectionCard, StatusBadge } from "./primitives";

export interface DlqQueueCount {
	queue: string;
	count: number;
}

export interface DlqEntry {
	id: string;
	queue: string;
	jobId: string;
	errorMessage: string;
	attemptsMade: number;
	failedAt: Date | string | null;
}

/**
 * Dead-letter queue: count-by-queue summary + the most recent failed jobs.
 * Read directly from Postgres.
 */
export function DlqPanel({
	counts,
	recent,
	error,
}: {
	counts: DlqQueueCount[];
	recent: DlqEntry[];
	error: boolean;
}) {
	const total = counts.reduce((sum, c) => sum + c.count, 0);

	return (
		<SectionCard
			title="Dead-Letter-Queue"
			description="Jobs, die nach allen Retries endgültig fehlgeschlagen sind."
		>
			{error ? (
				<EmptyHint>DLQ konnte nicht gelesen werden.</EmptyHint>
			) : total === 0 ? (
				<div className="rounded-md bg-success/10 p-3 text-sm text-success">
					Keine fehlgeschlagenen Jobs.
				</div>
			) : (
				<>
					<div className="mb-4 flex flex-wrap gap-2">
						{counts.map((c) => (
							<StatusBadge key={c.queue} tone="danger">
								{c.queue}: {c.count}
							</StatusBadge>
						))}
					</div>
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full text-sm">
							<thead className="bg-surface-alt text-left text-text-muted">
								<tr>
									<th scope="col" className="px-3 py-2 font-medium">
										Queue
									</th>
									<th scope="col" className="px-3 py-2 font-medium">
										Job-ID
									</th>
									<th scope="col" className="px-3 py-2 font-medium">
										Fehler
									</th>
									<th scope="col" className="px-3 py-2 text-right font-medium">
										Versuche
									</th>
									<th scope="col" className="px-3 py-2 font-medium">
										Fehlgeschlagen
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border bg-white">
								{recent.map((e) => (
									<tr key={e.id}>
										<td className="px-3 py-2 font-mono text-xs text-text">{e.queue}</td>
										<td className="px-3 py-2 font-mono text-xs text-text-muted">{e.jobId}</td>
										<td className="max-w-md truncate px-3 py-2 text-text" title={e.errorMessage}>
											{e.errorMessage}
										</td>
										<td className="px-3 py-2 text-right text-text">{e.attemptsMade}</td>
										<td className="px-3 py-2 text-xs text-text-muted">
											{e.failedAt ? new Date(e.failedAt).toLocaleString("de-DE") : "—"}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</SectionCard>
	);
}
