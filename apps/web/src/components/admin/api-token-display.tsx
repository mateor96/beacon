"use client";

import { useState } from "react";

interface Props {
	token: string;
}

export function ApiTokenDisplay({ token }: Props) {
	const [visible, setVisible] = useState(false);
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(token);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// no-op
		}
	}

	const display = visible
		? token
		: `${token.slice(0, 8)}${"•".repeat(Math.max(0, token.length - 8))}`;

	return (
		<div className="mt-2 flex items-center gap-2">
			<pre className="flex-1 overflow-x-auto rounded bg-white px-3 py-2 font-mono text-xs">
				{display}
			</pre>
			<button
				type="button"
				onClick={() => setVisible((v) => !v)}
				className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text transition-colors hover:bg-surface"
			>
				{visible ? "Verbergen" : "Anzeigen"}
			</button>
			<button
				type="button"
				onClick={copy}
				className="rounded-lg bg-primary px-3 py-1.5 text-xs text-text-inverse transition-colors hover:bg-primary-hover"
			>
				{copied ? "Kopiert!" : "Kopieren"}
			</button>
		</div>
	);
}
