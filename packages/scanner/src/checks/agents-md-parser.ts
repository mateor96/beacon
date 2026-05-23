// Pure parser for AGENTS.md files — shared with @beacon/ai generator (see #247).
// Extracted to avoid side-effect imports from the check module.

const AGENT_KEYWORDS = /agent|bot|assistant|service/i;
const CAPABILITY_KEYWORDS = /capabilit|skill|action|permission|scope|endpoint/i;
const CONTACT_KEYWORDS = /contact|kontakt|policy|richtlinie/i;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const HTML_TAG_REGEX = /<[a-z][a-z0-9]*[\s>]/i;

export interface ParsedAgentsMd {
	content: string;
	h1Lines: string[];
	h2Sections: string[];
	h3Sections: string[];
	agentSectionCount: number;
	hasCapabilities: boolean;
	hasContactInfo: boolean;
	hasHtmlTags: boolean;
	contentLength: number;
}

export function parseAgentsMd(content: string): ParsedAgentsMd {
	const normalized = content.replace(/\r\n|\r/g, "\n");
	const lines = normalized.split("\n");

	const h1Lines = lines.filter((l) => /^# .+/.test(l));
	const h2Sections = lines.filter((l) => /^## .+/.test(l));
	const h3Sections = lines.filter((l) => /^### .+/.test(l));

	const allSections = [...h2Sections, ...h3Sections];
	const agentSectionCount = allSections.filter((s) => AGENT_KEYWORDS.test(s)).length;

	const hasBullets = lines.some((l) => /^[-*]\s+/.test(l));
	const hasCapabilities = hasBullets && CAPABILITY_KEYWORDS.test(normalized);

	const hasContactInfo = EMAIL_REGEX.test(normalized) || CONTACT_KEYWORDS.test(normalized);
	const hasHtmlTags = HTML_TAG_REGEX.test(normalized);

	return {
		content: normalized,
		h1Lines,
		h2Sections,
		h3Sections,
		agentSectionCount,
		hasCapabilities,
		hasContactInfo,
		hasHtmlTags,
		contentLength: normalized.trim().length,
	};
}
