import { EmptyHint, SectionCard, StatusBadge } from "./primitives";

type EmailStatus = "queued" | "sent" | "failed" | "suppressed";

export interface EmailLogEntry {
	id: string;
	recipientEmail: string;
	subject: string;
	status: EmailStatus;
	sentAt: Date | string | null;
	createdAt: Date | string | null;
	errorMessage: string | null;
}

const STATUS_TONE: Record<EmailStatus, "success" | "danger" | "muted"> = {
	sent: "success",
	failed: "danger",
	queued: "muted",
	suppressed: "muted",
};

const STATUS_LABEL: Record<EmailStatus, string> = {
	sent: "Versendet",
	failed: "Fehlgeschlagen",
	queued: "In Warteschlange",
	suppressed: "Unterdrückt",
};

/** Recent outbound email-log entries (instance-wide). Read-only. */
export function EmailLogPanel({
	entries,
	error,
}: {
	entries: EmailLogEntry[];
	error: boolean;
}) {
	return (
		<SectionCard title="E-Mail-Log" description="Zuletzt versendete bzw. versuchte E-Mails.">
			{error ? (
				<EmptyHint>E-Mail-Log konnte nicht gelesen werden.</EmptyHint>
			) : entries.length === 0 ? (
				<EmptyHint>Noch keine E-Mails versendet.</EmptyHint>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface-alt text-left text-text-muted">
							<tr>
								<th scope="col" className="px-3 py-2 font-medium">
									Empfänger
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Betreff
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Status
								</th>
								<th scope="col" className="px-3 py-2 font-medium">
									Zeitpunkt
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{entries.map((e) => {
								const when = e.sentAt ?? e.createdAt;
								return (
									<tr key={e.id}>
										<td className="px-3 py-2 text-text">{e.recipientEmail}</td>
										<td className="max-w-md truncate px-3 py-2 text-text" title={e.subject}>
											{e.subject}
										</td>
										<td className="px-3 py-2">
											<StatusBadge tone={STATUS_TONE[e.status]}>
												{STATUS_LABEL[e.status]}
											</StatusBadge>
										</td>
										<td className="px-3 py-2 text-xs text-text-muted">
											{when ? new Date(when).toLocaleString("de-DE") : "—"}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</SectionCard>
	);
}
