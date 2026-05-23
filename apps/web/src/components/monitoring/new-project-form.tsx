"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "error";

function splitKeywords(input: string): string[] {
	return input
		.split(/[\n,]/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export function NewMonitoringProjectForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [websiteUrl, setWebsiteUrl] = useState("");
	const [brandKeywords, setBrandKeywords] = useState("");
	const [competitorKeywords, setCompetitorKeywords] = useState("");
	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (state === "submitting") return;

		const brands = splitKeywords(brandKeywords);
		const competitors = splitKeywords(competitorKeywords);

		if (brands.length === 0) {
			setState("error");
			setErrorMessage("Mindestens ein Brand-Keyword ist erforderlich.");
			return;
		}

		setState("submitting");
		setErrorMessage("");

		try {
			const res = await fetch("/api/monitoring/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name,
					websiteUrl,
					brandKeywords: brands,
					competitorKeywords: competitors.length > 0 ? competitors : undefined,
				}),
			});

			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte das Projekt nicht anlegen.");
			}

			const data = (await res.json()) as { id: string };
			router.push(`/monitoring/${data.id}`);
		} catch (err) {
			setState("error");
			setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div>
				<label htmlFor="proj-name" className="block text-sm font-medium text-text">
					Projektname
				</label>
				<input
					id="proj-name"
					type="text"
					required
					maxLength={200}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="z.B. Beacon Brand-Monitoring"
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div>
				<label htmlFor="proj-url" className="block text-sm font-medium text-text">
					Website-URL
				</label>
				<input
					id="proj-url"
					type="text"
					inputMode="url"
					required
					value={websiteUrl}
					onChange={(e) => setWebsiteUrl(e.target.value)}
					placeholder="z.B. beispiel.de"
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div>
				<label htmlFor="proj-brands" className="block text-sm font-medium text-text">
					Brand-Keywords{" "}
					<span className="text-text-muted">(eines pro Zeile oder komma-separiert)</span>
				</label>
				<textarea
					id="proj-brands"
					required
					rows={3}
					value={brandKeywords}
					onChange={(e) => setBrandKeywords(e.target.value)}
					placeholder={"Beacon\nbeacon.dev\nBeacon AI-Readiness"}
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div>
				<label htmlFor="proj-competitors" className="block text-sm font-medium text-text">
					Wettbewerber-Keywords <span className="text-text-muted">(optional)</span>
				</label>
				<textarea
					id="proj-competitors"
					rows={3}
					value={competitorKeywords}
					onChange={(e) => setCompetitorKeywords(e.target.value)}
					placeholder={"Lighthouse\nahrefs"}
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			{state === "error" && (
				<p role="alert" className="text-sm text-danger">
					{errorMessage}
				</p>
			)}

			<div className="flex gap-3">
				<button
					type="submit"
					disabled={state === "submitting"}
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					{state === "submitting" ? "Lege an…" : "Projekt anlegen"}
				</button>
				<a
					href="/monitoring"
					className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface"
				>
					Abbrechen
				</a>
			</div>
		</form>
	);
}
