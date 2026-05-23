"use client";

import { useState } from "react";

interface Props {
	shareToken: string;
}

export function SharePasswordForm({ shareToken }: Props) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch(`/api/public/report/${shareToken}/auth`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});
			if (res.ok) {
				window.location.href = `/report/${shareToken}`;
				return;
			}
			let message = "Passwort konnte nicht geprüft werden.";
			try {
				const data = (await res.json()) as { error?: { message?: string } };
				if (data?.error?.message) message = data.error.message;
			} catch {}
			setError(message);
		} catch {
			setError("Netzwerkfehler. Bitte erneut versuchen.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<label htmlFor="share-password" style={{ fontSize: 14, color: "#334155" }}>
				Passwort
			</label>
			<input
				id="share-password"
				type="password"
				autoComplete="current-password"
				required
				value={password}
				onChange={(e) => setPassword(e.target.value)}
				style={{
					padding: "10px 12px",
					border: "1px solid #cbd5e1",
					borderRadius: 6,
					fontSize: 14,
				}}
			/>
			{error && (
				<p role="alert" style={{ color: "#b91c1c", fontSize: 13, margin: 0 }}>
					{error}
				</p>
			)}
			<button
				type="submit"
				disabled={submitting || password.length === 0}
				style={{
					padding: "10px 16px",
					background: submitting ? "#94a3b8" : "#0f172a",
					color: "white",
					border: 0,
					borderRadius: 6,
					fontSize: 14,
					cursor: submitting ? "default" : "pointer",
				}}
			>
				{submitting ? "Prüfe…" : "Bericht öffnen"}
			</button>
		</form>
	);
}
