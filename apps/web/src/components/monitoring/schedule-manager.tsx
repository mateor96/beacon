"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ScheduleView {
	id: string;
	frequency: string;
	nextRunAt: string;
	lastRunAt: string | null;
	enabled: boolean;
}

const FREQUENCY_LABEL: Record<string, string> = {
	hourly: "Stündlich",
	daily: "Täglich",
	weekly: "Wöchentlich",
};

interface Props {
	projectId: string;
	schedules: ScheduleView[];
}

export function ScheduleManager({ projectId, schedules }: Props) {
	const router = useRouter();
	const [frequency, setFrequency] = useState("daily");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const base = `/api/monitoring/projects/${projectId}/schedules`;

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
			fetch(base, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ frequency }),
			}),
		);

	const toggle = (s: ScheduleView) =>
		run(() =>
			fetch(`${base}/${s.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: !s.enabled }),
			}),
		);

	const remove = (s: ScheduleView) => run(() => fetch(`${base}/${s.id}`, { method: "DELETE" }));

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<label htmlFor="schedule-frequency" className="sr-only">
					Frequenz
				</label>
				<select
					id="schedule-frequency"
					value={frequency}
					onChange={(e) => setFrequency(e.target.value)}
					disabled={busy}
					className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
				>
					<option value="hourly">Stündlich</option>
					<option value="daily">Täglich</option>
					<option value="weekly">Wöchentlich</option>
				</select>
				<button
					type="button"
					onClick={create}
					disabled={busy}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					Zeitplan hinzufügen
				</button>
			</div>

			{error && <p className="text-sm text-danger">{error}</p>}

			{schedules.length === 0 ? (
				<p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
					Noch keine Zeitpläne angelegt.
				</p>
			) : (
				<ul className="divide-y divide-border rounded-lg border border-border bg-white">
					{schedules.map((s) => (
						<li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
							<div>
								<div className="font-medium text-text">
									{FREQUENCY_LABEL[s.frequency] ?? s.frequency}
									{!s.enabled && <span className="ml-2 text-xs text-text-muted">(pausiert)</span>}
								</div>
								<div className="text-xs text-text-muted">
									Nächster Lauf: {new Date(s.nextRunAt).toLocaleString("de-DE")}
									{s.lastRunAt
										? ` · Letzter Lauf: ${new Date(s.lastRunAt).toLocaleString("de-DE")}`
										: ""}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => toggle(s)}
									disabled={busy}
									className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface-alt disabled:opacity-60"
								>
									{s.enabled ? "Pausieren" : "Aktivieren"}
								</button>
								<button
									type="button"
									onClick={() => remove(s)}
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
