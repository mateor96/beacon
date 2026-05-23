import { SEVERITY_LABELS } from "@/lib/format";
import type { AccessMode } from "@/lib/scan-access";
import type { ScanCheck } from "@beacon/shared";
import { FIX_GENERATOR_IDS } from "@beacon/shared";
import { FixButton } from "./fix-button";

interface CheckItemProps {
	check: ScanCheck;
	fix?: { content: string; filename: string; method: string } | null;
	scanId?: string;
	accessMode?: AccessMode;
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
	pass: { icon: "\u2713", color: "text-success" },
	warn: { icon: "!", color: "text-accent" },
	fail: { icon: "\u2717", color: "text-danger" },
	info: { icon: "i", color: "text-primary" },
};

export function CheckItem({ check, fix, scanId, accessMode }: CheckItemProps) {
	const isFixable = (FIX_GENERATOR_IDS as readonly string[]).includes(check.id);
	const { icon, color } = STATUS_ICONS[check.status] ?? STATUS_ICONS.info;

	return (
		<details className="group rounded-lg border border-border">
			<summary className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-surface-alt">
				<span
					className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${color}`}
					aria-hidden="true"
				>
					{icon}
				</span>
				<div className="flex-1 min-w-0">
					<span className="font-medium text-text">{check.name}</span>
					<span className="ml-2 text-xs text-text-muted">
						{SEVERITY_LABELS[check.severity] ?? check.severity}
					</span>
				</div>
				<span className="text-sm font-mono text-text-muted">{check.score}/100</span>
				<svg
					className="h-4 w-4 shrink-0 text-text-muted transition-transform group-open:rotate-180"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</summary>
			<div className="border-t border-border px-4 py-3">
				<p className="text-sm text-text-muted">{check.summary}</p>
				{check.issues.length > 0 && (
					<ul className="mt-2 space-y-1">
						{check.issues.map((issue) => (
							<li key={issue.message} className="flex items-start gap-2 text-sm">
								<span className="mt-0.5 text-xs text-text-muted">&bull;</span>
								<span className="text-text">{issue.message}</span>
							</li>
						))}
					</ul>
				)}
				{scanId && isFixable && accessMode === "owner" && (
					<div className="mt-3 border-t border-border pt-3">
						<FixButton scanId={scanId} checkId={check.id} existingFix={fix ?? null} />
					</div>
				)}
			</div>
		</details>
	);
}
