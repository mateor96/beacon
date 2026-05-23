/**
 * Alert dispatch orchestrator (#286).
 *
 * Runs after each monitoring cycle. Fetches enabled alerts for the
 * project, evaluates each rule, checks cooldown, and dispatches email
 * notifications via the existing EmailService/BullMQ pipeline.
 */

import type { DbClient } from "@beacon/db";
import {
	type AlertConfig,
	type EvaluationContext,
	evaluateAlert,
	isCooldownActive,
} from "./alert-evaluation.js";

export interface AlertDispatchContext {
	projectId: string;
	brandName: string;
	projectName: string;
	userId: string;
	userEmail: string;
	/** Current monitoring cycle results */
	currentMentionCount: number;
	previousMentionCount: number;
	currentAvgRank: number | null;
	previousAvgRank: number | null;
	newCitationCount: number;
}

export interface AlertDispatchResult {
	evaluated: number;
	fired: number;
	cooledDown: number;
	errors: number;
}

/**
 * Process alerts for a monitoring project after a visibility cycle completes.
 * Evaluates all enabled rules, respects cooldowns, dispatches email notifications.
 */
export async function processAlertsForProject(
	db: DbClient,
	ctx: AlertDispatchContext,
): Promise<AlertDispatchResult> {
	const { alertQueries } = await import("@beacon/db");

	// Fetch enabled alerts for this project
	const enabledAlerts = await alertQueries.getEnabledByProjectId(db, ctx.projectId);

	if (enabledAlerts.length === 0) {
		return { evaluated: 0, fired: 0, cooledDown: 0, errors: 0 };
	}

	const evalCtx: EvaluationContext = {
		currentMentionCount: ctx.currentMentionCount,
		previousMentionCount: ctx.previousMentionCount,
		currentAvgRank: ctx.currentAvgRank,
		previousAvgRank: ctx.previousAvgRank,
		newCitationCount: ctx.newCitationCount,
	};

	let fired = 0;
	let cooledDown = 0;
	let errors = 0;

	for (const alert of enabledAlerts) {
		try {
			const config = (alert.config ?? {}) as AlertConfig;

			// Cooldown check
			if (isCooldownActive(config)) {
				cooledDown++;
				continue;
			}

			// Evaluate the rule
			const result = evaluateAlert(alert.type, config, evalCtx);
			if (!result.shouldFire) continue;

			// Record the alert event
			await alertQueries.createEvent(db, {
				alertId: alert.id,
				payload: {
					ruleType: alert.type,
					summary: result.reason,
					currentValue: result.currentValue,
					previousValue: result.previousValue,
					changePercent: result.changePercent,
				},
			});

			// Update lastFiredAt in config
			await alertQueries.update(db, alert.id, {
				config: { ...config, lastFiredAt: new Date().toISOString() },
			});

			// Dispatch email via existing email queue
			if (alert.channel === "email") {
				try {
					const { addJob } = await import("@beacon/queue");
					const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com";

					await addJob("email", {
						emailLogId: `alert-${alert.id}-${Date.now()}`,
						to: [ctx.userEmail],
						from: process.env.EMAIL_FROM ?? "noreply@example.com",
						subject: `Beacon Alert: ${result.reason} — ${ctx.projectName}`,
						html: `<p>${result.reason}</p><p>Vorher: ${result.previousValue} → Nachher: ${result.currentValue}</p><p><a href="${appUrl}/dashboard/${ctx.projectId}/monitoring">Im Dashboard ansehen</a></p>`,
						text: `${result.reason}\nVorher: ${result.previousValue} → Nachher: ${result.currentValue}\n${appUrl}/dashboard/${ctx.projectId}/monitoring`,
					});
				} catch {
					// Email dispatch failure is non-critical
					errors++;
				}
			}

			fired++;
		} catch {
			errors++;
		}
	}

	return { evaluated: enabledAlerts.length, fired, cooledDown, errors };
}
