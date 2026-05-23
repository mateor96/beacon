/**
 * Pure alert evaluation engine (#286).
 *
 * Evaluates alert rules against monitoring data. No side effects —
 * takes data in, returns evaluation results out. The caller handles
 * persistence and dispatch.
 */

// ── Types ──────────────────────────────────────────────────

export type AlertRuleType = "visibility_drop" | "new_citation" | "competitor_gain";

export interface AlertConfig {
	projectId?: string;
	threshold?: number;
	cooldownMinutes?: number;
	lastFiredAt?: string;
}

export interface EvaluationContext {
	currentMentionCount: number;
	previousMentionCount: number;
	currentAvgRank: number | null;
	previousAvgRank: number | null;
	newCitationCount: number;
}

export interface EvaluationResult {
	shouldFire: boolean;
	reason: string;
	currentValue: number | string;
	previousValue: number | string;
	changePercent?: number;
}

// ── Cooldown ───────────────────────────────────────────────

const DEFAULT_COOLDOWN_MINUTES = 360; // 6 hours

export function isCooldownActive(config: AlertConfig, now: Date = new Date()): boolean {
	if (!config.lastFiredAt) return false;
	const cooldownMs = (config.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES) * 60 * 1000;
	const lastFired = new Date(config.lastFiredAt);
	return now.getTime() - lastFired.getTime() < cooldownMs;
}

// ── Rule Evaluators ────────────────────────────────────────

function evaluateVisibilityDrop(config: AlertConfig, ctx: EvaluationContext): EvaluationResult {
	const threshold = config.threshold ?? 20;

	if (ctx.previousMentionCount === 0) {
		return {
			shouldFire: false,
			reason: "Keine vorherigen Erwähnungen",
			currentValue: ctx.currentMentionCount,
			previousValue: 0,
		};
	}

	const dropPercent =
		((ctx.previousMentionCount - ctx.currentMentionCount) / ctx.previousMentionCount) * 100;

	if (dropPercent >= threshold) {
		return {
			shouldFire: true,
			reason: `Sichtbarkeit um ${Math.round(dropPercent)}% gesunken`,
			currentValue: ctx.currentMentionCount,
			previousValue: ctx.previousMentionCount,
			changePercent: -Math.round(dropPercent),
		};
	}

	return {
		shouldFire: false,
		reason: "Schwellwert nicht erreicht",
		currentValue: ctx.currentMentionCount,
		previousValue: ctx.previousMentionCount,
	};
}

function evaluateNewCitation(_config: AlertConfig, ctx: EvaluationContext): EvaluationResult {
	if (ctx.newCitationCount > 0) {
		return {
			shouldFire: true,
			reason: `${ctx.newCitationCount} neue Zitierung${ctx.newCitationCount > 1 ? "en" : ""} erkannt`,
			currentValue: ctx.newCitationCount,
			previousValue: 0,
		};
	}
	return {
		shouldFire: false,
		reason: "Keine neuen Zitierungen",
		currentValue: 0,
		previousValue: 0,
	};
}

function evaluateCompetitorGain(config: AlertConfig, ctx: EvaluationContext): EvaluationResult {
	const threshold = config.threshold ?? 3;

	if (ctx.currentAvgRank === null || ctx.previousAvgRank === null) {
		return {
			shouldFire: false,
			reason: "Keine Ranking-Daten",
			currentValue: "N/A",
			previousValue: "N/A",
		};
	}

	const rankDrop = ctx.currentAvgRank - ctx.previousAvgRank;

	if (rankDrop >= threshold) {
		return {
			shouldFire: true,
			reason: `Ranking um ${Math.round(rankDrop)} Positionen gefallen`,
			currentValue: ctx.currentAvgRank,
			previousValue: ctx.previousAvgRank,
		};
	}

	return {
		shouldFire: false,
		reason: "Schwellwert nicht erreicht",
		currentValue: ctx.currentAvgRank,
		previousValue: ctx.previousAvgRank,
	};
}

// ── Public API ──────────────────────────────────────────────

const EVALUATORS: Record<
	AlertRuleType,
	(config: AlertConfig, ctx: EvaluationContext) => EvaluationResult
> = {
	visibility_drop: evaluateVisibilityDrop,
	new_citation: evaluateNewCitation,
	competitor_gain: evaluateCompetitorGain,
};

/**
 * Evaluate a single alert rule against the current monitoring data.
 * Pure function — no DB access, no side effects.
 */
export function evaluateAlert(
	ruleType: string,
	config: AlertConfig,
	ctx: EvaluationContext,
): EvaluationResult {
	const evaluator = EVALUATORS[ruleType as AlertRuleType];
	if (!evaluator) {
		return {
			shouldFire: false,
			reason: `Unbekannter Regeltyp: ${ruleType}`,
			currentValue: "N/A",
			previousValue: "N/A",
		};
	}
	return evaluator(config, ctx);
}
