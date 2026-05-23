import type { DbClient } from "@beacon/db";
import { guaranteeQueries, profileQueries, scans } from "@beacon/db";
import { addJob } from "@beacon/queue";
import { desc, eq } from "drizzle-orm";
import { GUARANTEE_TERMS_PATH } from "./terms.js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com";
const GUARANTEE_DASHBOARD_PATH = "/dashboard/guarantee";
const GUARANTEE_REFUND_PATH = "/dashboard/guarantee/refund";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MilestoneEmailsResult {
	processed: number;
	enqueued: number;
	skipped: number;
}

/**
 * Days elapsed since the claim started (floored).
 */
function daysSince(startedAt: Date, now: Date): number {
	return Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS);
}

/**
 * Most recent completed scan for a user — used as "current score" input
 * for day-30 and day-60 interim emails. Returns null when the user has
 * no completed scans yet (email is skipped).
 */
async function latestCompletedScoreForUser(db: DbClient, userId: string): Promise<number | null> {
	const rows = await db
		.select({ score: scans.score })
		.from(scans)
		.where(eq(scans.userId, userId))
		.orderBy(desc(scans.scannedAt))
		.limit(10);
	const completed = rows.find((r) => typeof r.score === "number" && r.score > 0);
	return completed?.score ?? null;
}

/**
 * Daily cron handler. For every guarantee claim, determines which (if any)
 * of the 30/60/90-day milestones are due, writes an idempotent milestone
 * row, and enqueues the appropriate email. The unique index on
 * (claim_id, milestone_day) + `notified_at` keep this safe against reruns.
 */
export async function runMilestoneEmailsCron(db: DbClient): Promise<MilestoneEmailsResult> {
	const now = new Date();
	// Cron-time claim set: all claims that might have a due milestone. Keep
	// query cheap by filtering startedAt window client-side.
	const oldestCandidate = new Date(now.getTime() - 95 * DAY_MS);
	const claims = await guaranteeQueries.listClaimsSince(db, oldestCandidate);

	let enqueued = 0;
	let skipped = 0;

	for (const claim of claims) {
		if (!claim.userId) {
			skipped++;
			continue;
		}
		const age = daysSince(claim.startedAt, now);
		const milestoneDay = age >= 90 ? 90 : age >= 60 ? 60 : age >= 30 ? 30 : null;
		if (!milestoneDay) {
			skipped++;
			continue;
		}

		const existing = await guaranteeQueries.getMilestonesByClaim(db, claim.id);
		const existingForDay = existing.find((m) => m.milestoneDay === milestoneDay);
		if (existingForDay?.notifiedAt) {
			skipped++;
			continue;
		}

		const baseline = claim.baselineSnapshotId
			? await db
					.select({ score: scans.score })
					.from(scans)
					.where(eq(scans.id, claim.baselineSnapshotId))
					.limit(1)
					.then((r) => r[0])
			: null;
		const baselineScore = baseline?.score ?? 0;

		let currentScore: number;
		if (existingForDay && milestoneDay === 90) {
			// Day-90 worker (#229) already wrote the milestone row with the
			// comparison scan score. Reuse it.
			currentScore = existingForDay.currentScore;
		} else {
			const latest = await latestCompletedScoreForUser(db, claim.userId);
			if (latest === null) {
				skipped++;
				continue;
			}
			currentScore = latest;
		}

		const delta = currentScore - baselineScore;

		const milestone =
			existingForDay ??
			(await guaranteeQueries.createMilestone(db, {
				claimId: claim.id,
				milestoneDay,
				scanId: null,
				baselineScore,
				currentScore,
				delta,
			}));
		if (!milestone) {
			// Race: another instance just wrote it. Safe to skip this tick.
			skipped++;
			continue;
		}

		const profile = await profileQueries.getById(db, claim.userId);
		if (!profile?.email) {
			skipped++;
			continue;
		}

		const variant: "interim" | "improved" | "eligible_for_refund" =
			milestoneDay === 90
				? claim.status === "improved"
					? "improved"
					: "eligible_for_refund"
				: "interim";

		const { templates } = await import("@beacon/notifications");
		const rendered = templates["guarantee-milestone"](
			{
				milestoneDay,
				variant,
				baselineScore,
				currentScore,
				delta,
				dashboardUrl: `${APP_URL}${GUARANTEE_DASHBOARD_PATH}`,
				refundUrl: `${APP_URL}${GUARANTEE_REFUND_PATH}`,
				termsUrl: `${APP_URL}${GUARANTEE_TERMS_PATH}`,
			},
			"",
		);

		await addJob("email", {
			emailLogId: `guarantee-milestone-${claim.id}-${milestoneDay}`,
			to: [profile.email],
			from: process.env.EMAIL_FROM ?? "noreply@example.com",
			subject: rendered.subject,
			html: rendered.html,
			text: rendered.text,
		});

		await guaranteeQueries.markMilestoneNotified(db, milestone.id, now);
		enqueued++;
	}

	return { processed: claims.length, enqueued, skipped };
}
