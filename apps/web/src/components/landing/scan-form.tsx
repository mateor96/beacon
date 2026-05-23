"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

interface ScanFormProps {
	variant?: "hero" | "compact";
}

type FormState = "idle" | "submitting" | "error";

function normalizeUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return trimmed;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

export function ScanForm({ variant = "hero" }: ScanFormProps) {
	const router = useRouter();
	const [url, setUrl] = useState("");
	const [honeypot, setHoneypot] = useState("");
	const [state, setState] = useState<FormState>("idle");
	const [errorMessage, setErrorMessage] = useState("");

	async function handleSubmit(e: FormEvent) {
		e.preventDefault();

		if (state === "submitting") return;
		if (honeypot) return;

		const normalized = normalizeUrl(url);

		const { ScanRequestSchema } = await import("@beacon/shared");
		const result = ScanRequestSchema.safeParse({ url: normalized });

		if (!result.success) {
			setState("error");
			setErrorMessage(result.error.issues[0]?.message ?? "Ungültige URL.");
			return;
		}

		setState("submitting");
		setErrorMessage("");

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15_000);

			const res = await fetch("/api/scan", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: normalized }),
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

			const data = (await res.json()) as { scanId: string; resultsUrl: string };
			router.push(data.resultsUrl);
		} catch (err) {
			setState("error");
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

	const isCompact = variant === "compact";
	const errorId = "scan-form-error";

	return (
		<form onSubmit={handleSubmit} className={`mx-auto ${isCompact ? "max-w-md" : "max-w-xl"}`}>
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

			<div className="flex flex-col gap-3 sm:flex-row">
				<label htmlFor="scan-url-input" className="sr-only">
					Website-URL
				</label>
				<input
					id="scan-url-input"
					type="text"
					inputMode="url"
					autoComplete="url"
					autoCapitalize="none"
					autoCorrect="off"
					placeholder="z.B. beispiel.de"
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					aria-describedby={state === "error" ? errorId : undefined}
					aria-invalid={state === "error"}
					className={`flex-1 rounded-lg border border-border bg-surface px-4 ${
						isCompact ? "py-2.5 text-sm" : "py-3.5 text-base"
					} text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20`}
				/>
				<button
					type="submit"
					disabled={state === "submitting"}
					className={`rounded-lg bg-primary ${
						isCompact ? "px-6 py-2.5 text-sm" : "px-6 py-3.5 text-base"
					} font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60`}
				>
					{state === "submitting" ? (
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
							Wird analysiert...
						</span>
					) : isCompact ? (
						"Jetzt scannen"
					) : (
						"Kostenlos scannen"
					)}
				</button>
			</div>

			<div aria-live="assertive" className="mt-3">
				{state === "error" && (
					<p id={errorId} className="text-center text-sm text-danger">
						{errorMessage}
					</p>
				)}
			</div>
		</form>
	);
}
