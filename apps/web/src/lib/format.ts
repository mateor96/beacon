const rtf = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

const DIVISIONS: { amount: number; name: Intl.RelativeTimeFormatUnit }[] = [
	{ amount: 60, name: "seconds" },
	{ amount: 60, name: "minutes" },
	{ amount: 24, name: "hours" },
	{ amount: 7, name: "days" },
	{ amount: 4.34524, name: "weeks" },
	{ amount: 12, name: "months" },
	{ amount: Number.POSITIVE_INFINITY, name: "years" },
];

export function formatRelativeTime(date: Date): string {
	let duration = (date.getTime() - Date.now()) / 1000;
	for (const division of DIVISIONS) {
		if (Math.abs(duration) < division.amount) {
			return rtf.format(Math.round(duration), division.name);
		}
		duration /= division.amount;
	}
	return rtf.format(Math.round(duration), "years");
}

export function getScoreColor(score: number): string {
	if (score <= 20) return "bg-red-500 text-white";
	if (score <= 50) return "bg-orange-500 text-white";
	if (score <= 75) return "bg-yellow-500 text-black";
	return "bg-green-500 text-white";
}

export function getScoreRingColor(score: number): string {
	if (score <= 20) return "#b91c1c";
	if (score <= 50) return "#c2410c";
	if (score <= 75) return "#ca8a04";
	return "#15803d";
}

export function getScoreRating(score: number): string {
	if (score <= 20) return "Kritisch";
	if (score <= 50) return "Schwach";
	if (score <= 75) return "Gut";
	return "Ausgezeichnet";
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return "< 1s";
	return `${Math.round(ms / 1000)}s`;
}

export function extractHostname(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

export const CATEGORY_LABELS: Record<string, string> = {
	readability: "Lesbarkeit",
	interactivity: "Interaktivität",
	transactional: "Transaktional",
};

export const SEVERITY_LABELS: Record<string, string> = {
	critical: "Kritisch",
	important: "Wichtig",
	"nice-to-have": "Optional",
};

export function sanitizeNext(next: string | null): string {
	if (!next) return "/dashboard";
	if (!next.startsWith("/")) return "/dashboard";
	if (next.startsWith("//")) return "/dashboard";
	if (next.includes("\\")) return "/dashboard";
	for (const char of next) {
		const code = char.charCodeAt(0);
		if (code < 32 || code === 127) return "/dashboard";
	}
	return next;
}
