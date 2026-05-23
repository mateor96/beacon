"use client";

import { type FormEvent, useState } from "react";

interface WaitlistFormProps {
	variant?: "hero" | "compact";
}

type FormState = "idle" | "submitting" | "success" | "error";

export function WaitlistForm({ variant = "hero" }: WaitlistFormProps) {
	const [email, setEmail] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [websiteUrl, setWebsiteUrl] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();

		if (honeypot) return;

		setState("submitting");
		setErrorMessage("");

		try {
			const res = await fetch("/api/waitlist", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email,
					companyName: companyName || undefined,
					websiteUrl: websiteUrl || undefined,
					source: "landing",
				}),
			});

			if (!res.ok) {
				const data = (await res.json()) as { error?: string };
				throw new Error(data.error ?? "Ein Fehler ist aufgetreten.");
			}

			setState("success");
		} catch (err) {
			setState("error");
			setErrorMessage(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
		}
	}

	if (state === "success") {
		return (
			<div
				className={`rounded-lg border border-success/30 bg-success/10 p-6 text-center ${
					variant === "compact" ? "mx-auto max-w-md" : "mx-auto max-w-lg"
				}`}
			>
				<p className="font-semibold text-success">Fast geschafft!</p>
				<p className="mt-2 text-sm text-text-muted">
					Wir haben dir eine Bestätigungs-E-Mail gesendet. Bitte klicke auf den Link, um deine
					Anmeldung zu bestätigen (Double-Opt-In).
				</p>
			</div>
		);
	}

	if (variant === "compact") {
		return (
			<form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
				<input
					type="text"
					name="website_url_confirm"
					value={honeypot}
					onChange={(e) => setHoneypot(e.target.value)}
					className="absolute -left-[9999px] opacity-0"
					tabIndex={-1}
					autoComplete="off"
					aria-hidden="true"
				/>
				<input
					type="email"
					required
					placeholder="deine@email.de"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<button
					type="submit"
					disabled={state === "submitting"}
					className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					{state === "submitting" ? "..." : "Eintragen"}
				</button>
				{state === "error" && <p className="text-sm text-danger">{errorMessage}</p>}
			</form>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-3 text-left">
			<input
				type="text"
				name="website_url_confirm"
				value={honeypot}
				onChange={(e) => setHoneypot(e.target.value)}
				className="absolute -left-[9999px] opacity-0"
				tabIndex={-1}
				autoComplete="off"
				aria-hidden="true"
			/>

			<div>
				<input
					type="email"
					required
					placeholder="deine@email.de *"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<input
					type="text"
					placeholder="Firma (optional)"
					value={companyName}
					onChange={(e) => setCompanyName(e.target.value)}
					className="rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
				<input
					type="url"
					placeholder="Website-URL (optional)"
					value={websiteUrl}
					onChange={(e) => setWebsiteUrl(e.target.value)}
					className="rounded-lg border border-border bg-surface px-4 py-3 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
				/>
			</div>

			<button
				type="submit"
				disabled={state === "submitting"}
				className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
			>
				{state === "submitting" ? "Wird eingetragen..." : "Kostenlos auf die Warteliste"}
			</button>

			{state === "error" && <p className="text-center text-sm text-danger">{errorMessage}</p>}

			<p className="text-center text-xs text-text-muted">
				DSGVO-konform. Kein Spam. Jederzeit abmeldbar.
			</p>
		</form>
	);
}
