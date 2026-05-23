"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface Props {
	eventNames: string[];
}

type FormState = "idle" | "submitting" | "created" | "error";

export function NewWebhookForm({ eventNames }: Props) {
	const router = useRouter();
	const [url, setUrl] = useState("");
	const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("");
	const [createdSecret, setCreatedSecret] = useState<string | null>(null);

	function toggleEvent(name: string) {
		setSelectedEvents((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (state === "submitting") return;
		if (selectedEvents.size === 0) {
			setState("error");
			setErrorMessage("Mindestens ein Event-Typ ist erforderlich.");
			return;
		}

		setState("submitting");
		setErrorMessage("");

		try {
			const res = await fetch("/api/webhooks/endpoints", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url, events: [...selectedEvents] }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? "Konnte den Endpoint nicht anlegen.");
			}
			const data = (await res.json()) as { id: string; secret: string };
			setCreatedSecret(data.secret);
			setState("created");
		} catch (err) {
			setState("error");
			setErrorMessage(err instanceof Error ? err.message : "Unbekannter Fehler.");
		}
	}

	if (state === "created" && createdSecret) {
		return (
			<div className="space-y-6">
				<div className="rounded-lg border border-warn bg-warn/10 p-4">
					<h2 className="text-sm font-semibold text-text">Secret nur einmal sichtbar</h2>
					<p className="mt-1 text-sm text-text-muted">
						Speichere das Secret jetzt — es wird nirgendwo sonst zurückgegeben. Falls verloren,
						neuen Endpoint anlegen.
					</p>
					<pre className="mt-3 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-xs">
						{createdSecret}
					</pre>
				</div>
				<button
					type="button"
					onClick={() => router.push("/webhooks")}
					className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover"
				>
					Zur Liste
				</button>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div>
				<label htmlFor="wh-url" className="block text-sm font-medium text-text">
					Endpoint-URL
				</label>
				<input
					id="wh-url"
					type="url"
					required
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://deine-app.de/webhooks/beacon"
					className="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<fieldset className="space-y-2 rounded-lg border border-border bg-surface p-4">
				<legend className="px-2 text-sm font-medium text-text">Event-Typen</legend>
				{eventNames.map((name) => (
					<label key={name} className="flex items-center gap-2 text-sm text-text">
						<input
							type="checkbox"
							checked={selectedEvents.has(name)}
							onChange={() => toggleEvent(name)}
							className="rounded border-border"
						/>
						<code className="text-text-muted">{name}</code>
					</label>
				))}
			</fieldset>

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
					{state === "submitting" ? "Lege an…" : "Endpoint anlegen"}
				</button>
				<a
					href="/webhooks"
					className="rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface"
				>
					Abbrechen
				</a>
			</div>
		</form>
	);
}
