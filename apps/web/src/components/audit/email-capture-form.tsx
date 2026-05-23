"use client";

import { type FormEvent, useState } from "react";

interface EmailCaptureFormProps {
	jobId: string;
	onUnlocked: () => void;
}

type FormStatus = "idle" | "submitting" | "error";

export function EmailCaptureForm({ jobId, onUnlocked }: EmailCaptureFormProps) {
	const [email, setEmail] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [status, setStatus] = useState<FormStatus>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();

		if (status === "submitting") return;
		if (honeypot) return;

		const trimmedEmail = email.trim();
		if (!trimmedEmail || !trimmedEmail.includes("@")) {
			setStatus("error");
			setErrorMessage("Bitte gib eine gueltige E-Mail-Adresse ein.");
			return;
		}

		setStatus("submitting");
		setErrorMessage("");

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15_000);

			const res = await fetch(`/api/public/audit/${jobId}/unlock`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: trimmedEmail, companyName: companyName.trim() || undefined }),
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				if (res.status === 429) {
					throw new Error(data.error ?? "Zu viele Anfragen. Bitte später erneut versuchen.");
				}
				throw new Error(data.error ?? "Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
			}

			onUnlocked();
		} catch (err) {
			setStatus("error");
			if (err instanceof DOMException && err.name === "AbortError") {
				setErrorMessage("Der Server antwortet nicht. Bitte später erneut versuchen.");
			} else if (err instanceof TypeError) {
				setErrorMessage("Keine Internetverbindung. Bitte Verbindung prüfen.");
			} else {
				setErrorMessage(
					err instanceof Error
						? err.message
						: "Unerwarteter Fehler. Bitte später erneut versuchen.",
				);
			}
		}
	}

	const errorId = "email-capture-error";

	return (
		<form onSubmit={handleSubmit} className="mx-auto max-w-md">
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

			<div className="flex flex-col gap-3">
				<div>
					<label htmlFor="email-capture-email" className="mb-1 block text-sm font-medium text-text">
						E-Mail-Adresse *
					</label>
					<input
						id="email-capture-email"
						type="email"
						required
						placeholder="deine@email.de"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						aria-describedby={status === "error" ? errorId : undefined}
						aria-invalid={status === "error"}
						className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<div>
					<label
						htmlFor="email-capture-company"
						className="mb-1 block text-sm font-medium text-text"
					>
						Unternehmen (optional)
					</label>
					<input
						id="email-capture-company"
						type="text"
						placeholder="Dein Unternehmen"
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
						className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
					/>
				</div>

				<button
					type="submit"
					disabled={status === "submitting"}
					className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
				>
					{status === "submitting" ? (
						<span className="inline-flex items-center gap-2">
							<svg
								className="h-4 w-4 animate-spin"
								viewBox="0 0 24 24"
								fill="none"
								aria-hidden="true"
							>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							Wird freigeschaltet...
						</span>
					) : (
						"Report freischalten"
					)}
				</button>
			</div>

			<p className="mt-2 text-center text-xs text-text-muted">
				Wir speichern deine E-Mail nur für diesen Report.
			</p>

			<div aria-live="assertive" className="mt-3">
				{status === "error" && (
					<p id={errorId} className="text-center text-sm text-danger">
						{errorMessage}
					</p>
				)}
			</div>
		</form>
	);
}
