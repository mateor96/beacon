import type { Token } from "./types.js";

const URL_REGEX = /https?:\/\/[^\s)\]>"']+/g;

export function findUrlSpans(text: string): Array<{ start: number; end: number }> {
	// Find all URL spans in text
	const spans: Array<{ start: number; end: number }> = [];
	const regex = new RegExp(URL_REGEX.source, "g");
	let match: RegExpExecArray | null = regex.exec(text);
	while (match !== null) {
		spans.push({ start: match.index, end: match.index + match[0].length });
		match = regex.exec(text);
	}
	return spans;
}

function isWithinSpans(offset: number, spans: Array<{ start: number; end: number }>): boolean {
	return spans.some((s) => offset >= s.start && offset < s.end);
}

export function tokenize(text: string): Token[] {
	// Split on whitespace and punctuation, preserving offsets
	const tokens: Token[] = [];
	const urlSpans = findUrlSpans(text);
	// Match sequences of non-whitespace, non-punctuation chars (word-like tokens)
	const tokenRegex = /[^\s,;:!?()\[\]{}"'—–]+/g;
	let match: RegExpExecArray | null = tokenRegex.exec(text);
	while (match !== null) {
		const raw = match[0];
		// Strip leading/trailing markdown formatting
		const stripped = raw.replace(/^[*_`#]+|[*_`#]+$/g, "");
		if (stripped.length > 0) {
			// Adjust offset for leading stripped chars
			const leadStripped = raw.indexOf(stripped);
			const offset = match.index + leadStripped;
			tokens.push({
				text: stripped,
				offset,
				length: stripped.length,
				isUrl: isWithinSpans(offset, urlSpans),
			});
		}
		match = tokenRegex.exec(text);
	}
	return tokens;
}
