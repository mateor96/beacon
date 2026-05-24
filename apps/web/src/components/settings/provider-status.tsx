"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionCard, StatusBadge } from "./primitives";

export interface ProviderStatus {
	engine: string;
	label: string;
	envVar: string;
	configured: boolean;
	/** "db" = UI-managed (encrypted), "env" = from env var, "none" = unset. */
	source: "db" | "env" | "none";
	last4?: string;
	updatedAt?: string;
}

/**
 * Provider-key matrix + management. Shows which engines are configured and the
 * source (DB / env), and lets the operator add / rotate / delete UI-managed
 * keys (stored encrypted; DB overrides env, no restart). Never shows the value.
 */
export function ProviderStatusPanel({ providers }: { providers: ProviderStatus[] }) {
	const router = useRouter();
	const configuredCount = providers.filter((p) => p.configured).length;
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function run(engine: string, fn: () => Promise<Response>, clearDraft = false) {
		if (busy) return;
		setBusy(engine);
		setError(null);
		try {
			const res = await fn();
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Aktion fehlgeschlagen.");
			}
			if (clearDraft) setDrafts((d) => ({ ...d, [engine]: "" }));
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusy(null);
		}
	}

	const save = (engine: string) => {
		const value = (drafts[engine] ?? "").trim();
		if (!value) {
			setError("Key darf nicht leer sein.");
			return;
		}
		return run(
			engine,
			() =>
				fetch("/api/settings/provider-keys", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ engine, value }),
				}),
			true,
		);
	};

	const remove = (engine: string) =>
		run(engine, () => fetch(`/api/settings/provider-keys/${engine}`, { method: "DELETE" }));

	function badge(p: ProviderStatus) {
		if (p.source === "db") return <StatusBadge tone="success">Konfiguriert (DB)</StatusBadge>;
		if (p.source === "env") return <StatusBadge tone="success">Konfiguriert (env)</StatusBadge>;
		return <StatusBadge tone="danger">Fehlt</StatusBadge>;
	}

	return (
		<SectionCard
			title="AI-Provider"
			description="AI-Visibility-Tracking nutzt diese Engines. Mindestens ein konfigurierter Provider wird für Sweeps benötigt. Hier gesetzte Keys werden verschlüsselt gespeichert und überschreiben die env-Variable — ohne Neustart."
		>
			<div
				className={`mb-4 rounded-md p-3 text-sm ${
					configuredCount > 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
				}`}
			>
				{configuredCount > 0
					? `AI-Visibility-Sweep aktiv — ${configuredCount} von ${providers.length} Providern konfiguriert.`
					: "Kein AI-Provider konfiguriert — AI-Visibility-Sweeps sind deaktiviert."}
			</div>

			{error && <p className="mb-3 text-sm text-danger">{error}</p>}

			<ul className="divide-y divide-border">
				{providers.map((p) => (
					<li key={p.engine} className="py-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="min-w-0">
								<p className="font-medium text-text">{p.label}</p>
								<code className="text-xs text-text-muted">{p.envVar}</code>
								{p.source === "db" && p.last4 ? (
									<span className="ml-2 text-xs text-text-muted">
										…{p.last4}
										{p.updatedAt
											? ` · aktualisiert ${new Date(p.updatedAt).toLocaleDateString("de-DE")}`
											: ""}
									</span>
								) : null}
							</div>
							{badge(p)}
						</div>
						<div className="mt-2 flex flex-wrap items-center gap-2">
							<input
								type="password"
								autoComplete="off"
								value={drafts[p.engine] ?? ""}
								onChange={(e) => setDrafts((d) => ({ ...d, [p.engine]: e.target.value }))}
								placeholder={
									p.source === "db" ? "Neuen Key eingeben (rotieren)" : "API-Key eingeben"
								}
								disabled={busy === p.engine}
								className="min-w-0 flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-text"
							/>
							<button
								type="button"
								onClick={() => save(p.engine)}
								disabled={busy === p.engine}
								className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
							>
								Speichern
							</button>
							{p.source === "db" && (
								<button
									type="button"
									onClick={() => remove(p.engine)}
									disabled={busy === p.engine}
									className="rounded-lg border border-danger/40 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
								>
									Entfernen
								</button>
							)}
						</div>
					</li>
				))}
			</ul>

			<p className="mt-4 text-xs text-text-muted">
				Hier gespeicherte Keys liegen verschlüsselt in der Datenbank (benötigt
				<code> PROVIDER_KEYS_KEY</code>). Diese Beacon-Instanz hat keinen Login — wer Zugriff hat,
				kann Keys verwalten. Schütze die Instanz auf Netzwerkebene. Alternativ Keys via
				<code> .env</code> setzen.
			</p>
		</SectionCard>
	);
}
