import { SectionCard, StatusBadge } from "./primitives";

export interface ProviderStatus {
	label: string;
	envVar: string;
	configured: boolean;
}

/**
 * Provider-key matrix. Read-only: shows which AI engines are configured (and
 * which env var unlocks each missing one). Never echoes secret values.
 */
export function ProviderStatusPanel({ providers }: { providers: ProviderStatus[] }) {
	const configuredCount = providers.filter((p) => p.configured).length;

	return (
		<SectionCard
			title="AI-Provider"
			description="AI-Visibility-Tracking nutzt diese Engines. Mindestens ein konfigurierter Provider wird für Sweeps benötigt."
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

			<ul className="divide-y divide-border">
				{providers.map((p) => (
					<li key={p.envVar} className="flex items-center justify-between gap-3 py-3">
						<div className="min-w-0">
							<p className="font-medium text-text">{p.label}</p>
							<code className="text-xs text-text-muted">{p.envVar}</code>
						</div>
						{p.configured ? (
							<StatusBadge tone="success">Konfiguriert</StatusBadge>
						) : (
							<StatusBadge tone="danger">Fehlt</StatusBadge>
						)}
					</li>
				))}
			</ul>

			<p className="mt-4 text-xs text-text-muted">
				Keys werden ausschließlich über env-Variablen gesetzt (Beacon speichert keine Secrets in der
				Datenbank). Fehlenden Key in <code>.env</code> eintragen und Web + Worker neu starten.
			</p>
		</SectionCard>
	);
}
