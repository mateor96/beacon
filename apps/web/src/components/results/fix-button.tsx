"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface FixButtonProps {
	scanId: string;
	checkId: string;
	existingFix: { content: string; filename: string; method: string } | null;
}

type FixState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "polling"; startedAt: number }
	| { status: "success"; fix: { content: string; filename: string; method: string } }
	| { status: "error"; message: string }
	| { status: "upgrade" };

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 90_000;

export function FixButton({ scanId, checkId, existingFix }: FixButtonProps) {
	const [state, setState] = useState<FixState>(
		existingFix ? { status: "success", fix: existingFix } : { status: "idle" },
	);
	const [showFix, setShowFix] = useState(false);
	const [copied, setCopied] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const stopPolling = useCallback(() => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
			pollRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => stopPolling();
	}, [stopPolling]);

	const poll = useCallback(() => {
		pollRef.current = setInterval(async () => {
			try {
				const res = await fetch(`/api/scan/${scanId}`);
				if (!res.ok) {
					stopPolling();
					setState({ status: "error", message: "Fehler beim Laden des Scans." });
					return;
				}
				const scan = await res.json();
				const fix = scan.fixes?.[checkId];
				if (fix) {
					stopPolling();
					setState({ status: "success", fix });
					setShowFix(true);
					return;
				}
				// Check timeout
				if (state.status === "polling" && Date.now() - state.startedAt > POLL_TIMEOUT_MS) {
					stopPolling();
					setState({
						status: "error",
						message: "Zeitüberschreitung. Bitte versuche es erneut.",
					});
				}
			} catch {
				stopPolling();
				setState({ status: "error", message: "Netzwerkfehler." });
			}
		}, POLL_INTERVAL_MS);
	}, [scanId, checkId, state, stopPolling]);

	const requestFix = async () => {
		setState({ status: "loading" });
		try {
			const res = await fetch("/api/fix", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ scanId, checkId }),
			});

			if (res.status === 403) {
				setState({ status: "upgrade" });
				return;
			}

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				setState({
					status: "error",
					message: body?.error ?? "Fehler beim Generieren.",
				});
				return;
			}

			const now = Date.now();
			setState({ status: "polling", startedAt: now });
			poll();
		} catch {
			setState({ status: "error", message: "Netzwerkfehler." });
		}
	};

	const handleCopy = async (content: string) => {
		await navigator.clipboard.writeText(content);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Show existing fix toggle
	if (state.status === "success") {
		return (
			<div>
				<button
					type="button"
					onClick={() => setShowFix((v) => !v)}
					className="rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-success hover:bg-success/20 transition-colors"
				>
					{showFix ? "Fix ausblenden" : "Fix anzeigen"}
				</button>

				{showFix && (
					<div className="mt-3 rounded-lg border border-border overflow-hidden">
						<div className="flex items-center justify-between bg-surface-alt px-4 py-2">
							<span className="text-sm font-mono text-text-muted">{state.fix.filename}</span>
							<button
								type="button"
								onClick={() => handleCopy(state.fix.content)}
								className="rounded px-3 py-1 text-xs font-medium text-text-muted hover:text-text hover:bg-border/50 transition-colors"
							>
								{copied ? "Kopiert!" : "Kopieren"}
							</button>
						</div>
						<pre className="overflow-x-auto bg-surface-alt p-4">
							<code className="text-sm font-mono text-text">{state.fix.content}</code>
						</pre>
					</div>
				)}
			</div>
		);
	}

	if (state.status === "upgrade") {
		return (
			<div className="flex items-center gap-3">
				<span className="text-sm text-text-muted">Ab Pro-Plan verfügbar</span>
				<Link
					href="/pricing"
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
				>
					Pläne ansehen
				</Link>
			</div>
		);
	}

	if (state.status === "error") {
		return (
			<div className="flex items-center gap-3">
				<span className="text-sm text-danger">{state.message}</span>
				<button
					type="button"
					onClick={requestFix}
					className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-alt transition-colors"
				>
					Erneut versuchen
				</button>
			</div>
		);
	}

	const isLoading = state.status === "loading" || state.status === "polling";

	return (
		<button
			type="button"
			onClick={requestFix}
			disabled={isLoading}
			className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{isLoading ? "Generiert..." : "Fix generieren"}
		</button>
	);
}
