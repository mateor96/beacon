"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
	projectId: string;
}

export function CrawlTrigger({ projectId }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	async function handleClick() {
		if (busy) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/monitoring/projects/${projectId}/crawl`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{}",
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte den Crawl nicht starten.");
			}
			setMessage("Crawl gestartet. Bis zu 200 Seiten, max. 3 Ebenen tief.");
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
				disabled={busy}
				className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-primary hover:text-text-inverse disabled:opacity-60"
			>
				{busy ? "Starte Crawl…" : "Site crawlen"}
			</button>
		</div>
	);
}
