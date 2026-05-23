"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Endpoint {
	id: string;
	url: string;
	events: string[];
	active: boolean;
	createdAt: string;
}

interface Props {
	endpoints: Endpoint[];
}

export function WebhookListClient({ endpoints }: Props) {
	const router = useRouter();
	const [busyId, setBusyId] = useState<string | null>(null);

	async function toggleActive(id: string, currentlyActive: boolean) {
		if (busyId) return;
		setBusyId(id);
		try {
			const res = await fetch(`/api/webhooks/endpoints/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ active: !currentlyActive }),
			});
			if (!res.ok) throw new Error("Konnte den Status nicht ändern.");
			router.refresh();
		} catch (err) {
			window.alert(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusyId(null);
		}
	}

	async function deleteEndpoint(id: string, url: string) {
		if (busyId) return;
		const ok = window.confirm(`Webhook für "${url}" wirklich löschen?`);
		if (!ok) return;
		setBusyId(id);
		try {
			const res = await fetch(`/api/webhooks/endpoints/${id}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) throw new Error("Konnte den Endpoint nicht löschen.");
			router.refresh();
		} catch (err) {
			window.alert(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusyId(null);
		}
	}

	if (endpoints.length === 0) {
		return (
			<div className="rounded-lg border border-border bg-surface p-12 text-center">
				<p className="text-text-muted">Noch keine Webhooks. Lege einen an.</p>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-lg border border-border">
			<table className="w-full text-sm">
				<thead className="bg-surface text-left text-text-muted">
					<tr>
						<th className="px-4 py-3 font-medium">URL</th>
						<th className="px-4 py-3 font-medium">Events</th>
						<th className="px-4 py-3 font-medium">Status</th>
						<th className="px-4 py-3 text-right" />
					</tr>
				</thead>
				<tbody className="divide-y divide-border bg-white">
					{endpoints.map((e) => (
						<tr key={e.id}>
							<td className="px-4 py-3 font-medium text-text">{e.url}</td>
							<td className="px-4 py-3 text-text-muted">
								<span className="line-clamp-1">{e.events.join(", ")}</span>
							</td>
							<td className="px-4 py-3">
								<button
									type="button"
									disabled={busyId === e.id}
									onClick={() => toggleActive(e.id, e.active)}
									className={`rounded-full px-3 py-1 text-xs font-medium ${
										e.active ? "bg-success/10 text-success" : "bg-border/40 text-text-muted"
									}`}
								>
									{e.active ? "aktiv" : "inaktiv"}
								</button>
							</td>
							<td className="px-4 py-3 text-right">
								<button
									type="button"
									disabled={busyId === e.id}
									onClick={() => deleteEndpoint(e.id, e.url)}
									className="rounded-lg border border-danger px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger hover:text-text-inverse disabled:opacity-60"
								>
									Löschen
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
