"use client";

import type { ScanResponse } from "@/types/scan-api";
import { isPollable } from "@/types/scan-api";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 2_000;
const MAX_POLL_DURATION_MS = 120_000;
const MAX_CONSECUTIVE_ERRORS = 3;

export type ScanPhase = "polling" | "completed" | "failed" | "error" | "timeout";

interface UseScanPollingResult {
	scan: ScanResponse;
	phase: ScanPhase;
	elapsedMs: number;
}

function getPhase(scan: ScanResponse): ScanPhase {
	if (scan.status === "completed") return "completed";
	if (scan.status === "failed") return "failed";
	return "polling";
}

export function useScanPolling(
	scanId: string,
	initialScan: ScanResponse,
	accessToken?: string,
): UseScanPollingResult {
	const [scan, setScan] = useState<ScanResponse>(initialScan);
	const [phase, setPhase] = useState<ScanPhase>(getPhase(initialScan));
	const [elapsedMs, setElapsedMs] = useState(0);

	const startTimeRef = useRef(Date.now());
	const errorCountRef = useRef(0);
	const abortRef = useRef<AbortController | null>(null);

	const poll = useCallback(async () => {
		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const pollUrl = accessToken
				? `/api/scan/${scanId}?access=${accessToken}`
				: `/api/scan/${scanId}`;
			const res = await fetch(pollUrl, {
				signal: controller.signal,
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);

			const data = (await res.json()) as ScanResponse;
			errorCountRef.current = 0;
			setScan(data);

			if (!isPollable(data)) {
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
	}, [scanId, accessToken]);

	useEffect(() => {
		if (!isPollable(initialScan)) return;

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
	}, [initialScan, poll]);

	return { scan, phase, elapsedMs };
}
