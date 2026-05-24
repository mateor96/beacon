"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface CompetitorView {
	id: string;
	name: string;
	domain: string | null;
	latestBenchmark: {
		shareOfVoice: number;
		avgSentiment: number;
		avgRank: number;
		model: string;
		benchmarkedAt: string;
	} | null;
}

export function CompetitorManager({
	projectId,
	competitors,
}: {
	projectId: string;
	competitors: CompetitorView[];
}) {
	const router = useRouter();
	const [name, setName] = useState("");
	const [domain, setDomain] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const base = `/api/monitoring/projects/${projectId}/competitors`;

	async function run(fn: () => Promise<Response>, onOk?: () => void) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fn();
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Aktion fehlgeschlagen.");
			}
			onOk?.();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
		} finally {
			setBusy(false);
		}
	}

	const add = () => {
		if (!name.trim()) {
			setError("Name ist erforderlich.");
			return;
		}
		return run(
			() =>
				fetch(base, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: name.trim(), domain: domain.trim() || undefined }),
				}),
			() => {
				setName("");
				setDomain("");
			},
		);
	};

	const remove = (c: CompetitorView) => run(() => fetch(`${base}/${c.id}`, { method: "DELETE" }));

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Wettbewerber-Name"
					disabled={busy}
					className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
				/>
				<input
					value={domain}
					onChange={(e) => setDomain(e.target.value)}
					placeholder="Domain (optional)"
					disabled={busy}
					className="rounded-lg border border-border bg-white px-3 py-2 text-sm text-text"
				/>
				<button
					type="button"
					onClick={add}
					disabled={busy}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					Hinzufügen
				</button>
			</div>

			{error && <p className="text-sm text-danger">{error}</p>}

			{competitors.length === 0 ? (
				<p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
					Noch keine Wettbewerber. Lege welche an, um Share-of-Voice gegen deine Brand zu
					vergleichen — Benchmarks erscheinen nach dem nächsten AI-Visibility-Sweep.
				</p>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead className="bg-surface text-left text-text-muted">
							<tr>
								<th scope="col" className="px-4 py-2 font-medium">
									Wettbewerber
								</th>
								<th scope="col" className="px-4 py-2 text-right font-medium">
									Share of Voice
								</th>
								<th scope="col" className="px-4 py-2 text-right font-medium">
									Ø Sentiment
								</th>
								<th scope="col" className="px-4 py-2 text-right font-medium">
									Ø Rang
								</th>
								<th scope="col" className="px-4 py-2 font-medium">
									Stand
								</th>
								<th scope="col" className="px-4 py-2" />
							</tr>
						</thead>
						<tbody className="divide-y divide-border bg-white">
							{competitors.map((c) => (
								<tr key={c.id}>
									<td className="px-4 py-2">
										<div className="font-medium text-text">{c.name}</div>
										{c.domain && <div className="text-xs text-text-muted">{c.domain}</div>}
									</td>
									<td className="px-4 py-2 text-right text-text">
										{c.latestBenchmark
											? `${(c.latestBenchmark.shareOfVoice * 100).toFixed(0)} %`
											: "—"}
									</td>
									<td className="px-4 py-2 text-right text-text">
										{c.latestBenchmark ? c.latestBenchmark.avgSentiment.toFixed(2) : "—"}
									</td>
									<td className="px-4 py-2 text-right text-text">
										{c.latestBenchmark ? c.latestBenchmark.avgRank.toFixed(1) : "—"}
									</td>
									<td className="px-4 py-2 text-xs text-text-muted">
										{c.latestBenchmark
											? new Date(c.latestBenchmark.benchmarkedAt).toLocaleDateString("de-DE")
											: "Noch kein Benchmark"}
									</td>
									<td className="px-4 py-2 text-right">
										<button
											type="button"
											onClick={() => remove(c)}
											disabled={busy}
											className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
										>
											Löschen
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
