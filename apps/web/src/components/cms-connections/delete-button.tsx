"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
	id: string;
	label: string;
}

export function DeleteConnectionButton({ id, label }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function handleClick() {
		if (busy) return;
		const ok = window.confirm(
			`Verbindung "${label}" wirklich löschen? Die verschlüsselten Credentials werden gelöscht.`,
		);
		if (!ok) return;

		setBusy(true);
		try {
			const res = await fetch(`/api/cms-connections/${id}`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte die Verbindung nicht löschen.");
			}
			router.refresh();
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
			className="rounded-lg border border-danger px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger hover:text-text-inverse disabled:opacity-60"
		>
			{busy ? "Lösche…" : "Löschen"}
		</button>
	);
}
