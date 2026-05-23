import { CATEGORY_LABELS } from "@/lib/format";
import type { AccessMode } from "@/lib/scan-access";
import type { ScanCheck } from "@beacon/shared";
import { CheckItem } from "./check-item";

interface CheckListProps {
	checks: ScanCheck[];
	fixes?: Record<string, { content: string; filename: string; method: string }> | null;
	scanId?: string;
	accessMode?: AccessMode;
}

const CATEGORY_ORDER = ["readability", "interactivity", "transactional"] as const;

export function CheckList({ checks, fixes, scanId, accessMode }: CheckListProps) {
	const grouped = new Map<string, ScanCheck[]>();
	for (const check of checks) {
		const list = grouped.get(check.category) ?? [];
		list.push(check);
		grouped.set(check.category, list);
	}

	return (
		<div className="space-y-6">
			{CATEGORY_ORDER.map((category) => {
				const items = grouped.get(category);
				if (!items?.length) return null;

				return (
					<section key={category}>
						<h3 className="mb-3 text-lg font-semibold text-text">
							{CATEGORY_LABELS[category] ?? category}
						</h3>
						<div className="space-y-2">
							{items.map((check) => (
								<CheckItem
									key={check.id}
									check={check}
									fix={fixes?.[check.id] ?? null}
									scanId={scanId}
									accessMode={accessMode}
								/>
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
