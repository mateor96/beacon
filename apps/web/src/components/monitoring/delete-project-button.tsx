"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
	id: string;
	name: string;
}

export function DeleteProjectButton({ id, name }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function handleClick() {
		if (busy) return;
		const ok = window.confirm(
			`Projekt "${name}" wirklich löschen? Historische Snapshots bleiben in der DB erhalten.`,
		);
		if (!ok) return;

		setBusy(true);
		try {
			const res = await fetch(`/api/monitoring/projects/${id}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte das Projekt nicht löschen.");
			}
			router.push("/monitoring");
		} catch (err) {
			window.alert(err instanceof Error ? err.message : "Unbekannter Fehler.");
			setBusy(false);
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={busy}
			className="rounded-lg border border-danger px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger hover:text-text-inverse disabled:opacity-60"
		>
			{busy ? "Lösche…" : "Projekt löschen"}
		</button>
	);
}
