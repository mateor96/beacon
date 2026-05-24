"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
	projectId: string;
	/** When true, no AI provider key is configured — trigger is disabled. */
	disabled?: boolean;
}

/**
 * Triggers a manual AI-visibility sweep. Confirms first (spends provider
 * credits) and is disabled when no provider key is configured.
 */
export function SweepTrigger({ projectId, disabled = false }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function handleClick() {
		if (busy || disabled) return;
		if (!window.confirm("Sweep jetzt starten? Dies verursacht AI-Provider-Kosten.")) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/monitoring/projects/${projectId}/sweep`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte den Sweep nicht starten.");
			}
			setMessage("Sweep gestartet. Snapshots erscheinen, sobald der Worker fertig ist.");
			setTimeout(() => router.refresh(), 8000);
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
				disabled={busy || disabled}
				title={disabled ? "Kein AI-Provider konfiguriert (siehe Status & Health)" : undefined}
				className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-primary hover:text-text-inverse disabled:cursor-not-allowed disabled:opacity-60"
			>
				{busy ? "Starte Sweep…" : "Sweep jetzt starten"}
			</button>
		</div>
	);
}
