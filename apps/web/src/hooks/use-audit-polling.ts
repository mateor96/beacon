"use client";

import type { PublicAuditResponse } from "@/types/public-audit";
import { isPollableAudit } from "@/types/public-audit";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 120_000;
const MAX_CONSECUTIVE_ERRORS = 3;

export type AuditPhase = "polling" | "completed" | "failed" | "error" | "timeout";

interface UseAuditPollingResult {
	audit: PublicAuditResponse;
	phase: AuditPhase;
	elapsedMs: number;
}

function getPhase(audit: PublicAuditResponse): AuditPhase {
	if (audit.status === "completed") return "completed";
	if (audit.status === "failed") return "failed";
	return "polling";
}

export function useAuditPolling(
	jobId: string,
	initialAudit: PublicAuditResponse,
): UseAuditPollingResult {
	const [audit, setAudit] = useState<PublicAuditResponse>(initialAudit);
	const [phase, setPhase] = useState<AuditPhase>(getPhase(initialAudit));
	const [elapsedMs, setElapsedMs] = useState(0);

	const startTimeRef = useRef(Date.now());
	const errorCountRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	const poll = useCallback(async () => {
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const res = await fetch(`/api/public/audit/${jobId}`, {
				signal: controller.signal,
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const data = (await res.json()) as PublicAuditResponse;
			errorCountRef.current = 0;
			setAudit(data);

			if (!isPollableAudit(data)) {
				setPhase(getPhase(data));
				return false; // stop polling
			}

			return true; // continue polling
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return false;
			}

			errorCountRef.current += 1;
			if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
				setPhase("error");
				return false;
			}

			return true; // retry
		}
	}, [jobId]);

	useEffect(() => {
		if (!isPollableAudit(initialAudit)) return;

		let timeoutId: ReturnType<typeof setTimeout>;
		let cancelled = false;

		startTimeRef.current = Date.now();

		const elapsedIntervalId = setInterval(() => {
			const elapsed = Date.now() - startTimeRef.current;
			setElapsedMs(elapsed);

			if (elapsed >= MAX_POLL_DURATION_MS) {
				setPhase("timeout");
				clearInterval(elapsedIntervalId);
			}
		}, 1_000);

		async function loop() {
			if (cancelled) return;

			const elapsed = Date.now() - startTimeRef.current;
			if (elapsed >= MAX_POLL_DURATION_MS) {
				setPhase("timeout");
				return;
			}

			const shouldContinue = await poll();
			if (shouldContinue && !cancelled) {
				timeoutId = setTimeout(loop, POLL_INTERVAL_MS);
			}
		}

		// Start first poll after interval
		timeoutId = setTimeout(loop, POLL_INTERVAL_MS);

		return () => {
			cancelled = true;
			clearTimeout(timeoutId);
			clearInterval(elapsedIntervalId);
			abortRef.current?.abort();
		};
	}, [initialAudit, poll]);

	return { audit, phase, elapsedMs };
}
