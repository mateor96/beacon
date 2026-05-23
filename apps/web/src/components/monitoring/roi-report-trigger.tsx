"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
	projectId: string;
}

export function RoiReportTrigger({ projectId }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function handleClick() {
		if (busy) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/monitoring/projects/${projectId}/roi-report`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte den Report nicht starten.");
			}
			setMessage("Report wird im Hintergrund erstellt. Lade die Seite in 30s neu.");
			// Refresh after a short delay to surface the new entry once the
			// worker has written the roi-reports row.
			setTimeout(() => router.refresh(), 5000);
		} catch (err) {
			setMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			{message && <span className="text-xs text-text-muted">{message}</span>}
			<button
				type="button"
				onClick={handleClick}
				disabled={busy}
				className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
			>
				{busy ? "Stelle in Queue…" : "Report erstellen"}
			</button>
		</div>
	);
}
