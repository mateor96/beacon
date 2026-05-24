import type { ScheduleFrequency } from "@beacon/shared";

const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
	hourly: 60 * 60 * 1000,
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
};

/** Next run timestamp for a freshly created or re-scheduled monitoring schedule. */
export function computeNextRunAt(frequency: ScheduleFrequency, from: Date = new Date()): Date {
	return new Date(from.getTime() + FREQUENCY_MS[frequency]);
}
