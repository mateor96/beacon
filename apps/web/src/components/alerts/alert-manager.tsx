"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface AlertView {
	id: string;
	type: string;
	channel: string;
	enabled: boolean;
	projectId: string | null;
}

const TYPE_LABEL: Record<string, string> = {
	visibility_drop: "Sichtbarkeit gesunken",
	new_citation: "Neue Citation",
	competitor_gain: "Wettbewerber legt zu",
};

const CHANNEL_LABEL: Record<string, string> = {
	email: "E-Mail",
	webhook: "Webhook",
};

export function AlertManager({
	alerts,
	projectId,
}: {
	alerts: AlertView[];
	/** When set, a create form is shown and new alerts bind to this project. */
	projectId?: string;
}) {
	const router = useRouter();
	const [type, setType] = useState("visibility_drop");
	const [channel, setChannel] = useState("email");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function run(fn: () => Promise<Response>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fn();
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Aktion fehlgeschlagen.");
			}
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusy(false);
		}
	}

	const create = () =>
		run(() =>
			fetch("/api/alerts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ type, channel, projectId }),
			}),
		);

	const toggle = (a: AlertView) =>
		run(() =>
			fetch(`/api/alerts/${a.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !a.enabled }),
			}),
		);

	const remove = (a: AlertView) => run(() => fetch(`/api/alerts/${a.id}`, { method: "DELETE" }));

	return (
		<div className="space-y-4">
			{projectId && (
				<div className="flex flex-wrap items-center gap-2">
					<select
						aria-label="Alert-Typ"
						value={type}
						onChange={(e) => setType(e.target.value)}
						disabled={busy}
						className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
					>
						<option value="visibility_drop">Sichtbarkeit gesunken</option>
						<option value="new_citation">Neue Citation</option>
						<option value="competitor_gain">Wettbewerber legt zu</option>
					</select>
					<select
						aria-label="Kanal"
						value={channel}
						onChange={(e) => setChannel(e.target.value)}
						disabled={busy}
						className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
					>
						<option value="email">E-Mail</option>
						<option value="webhook">Webhook</option>
					</select>
					<button
						type="button"
						onClick={create}
						disabled={busy}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
					>
						Alert hinzufügen
					</button>
				</div>
			)}

			{error && <p className="text-sm text-danger">{error}</p>}

			{alerts.length === 0 ? (
				<p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
					Keine Alerts konfiguriert.
					{!projectId && " Lege Alerts im jeweiligen Projekt im Tab Alerts an."}
				</p>
			) : (
				<ul className="divide-y divide-border rounded-lg border border-border bg-white">
					{alerts.map((a) => (
						<li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
							<div>
								<div className="font-medium text-text">
									{TYPE_LABEL[a.type] ?? a.type}
									{!a.enabled && <span className="ml-2 text-xs text-text-muted">(pausiert)</span>}
								</div>
								<div className="text-xs text-text-muted">
									Kanal: {CHANNEL_LABEL[a.channel] ?? a.channel}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => toggle(a)}
									disabled={busy}
									className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-alt disabled:opacity-60"
								>
									{a.enabled ? "Pausieren" : "Aktivieren"}
								</button>
								<button
									type="button"
									onClick={() => remove(a)}
									disabled={busy}
									className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
								>
									Löschen
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
