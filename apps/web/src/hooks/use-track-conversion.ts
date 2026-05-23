"use client";

import { useEffect, useRef } from "react";

export function useTrackConversion(jobId: string, eventType: string, enabled: boolean): void {
	const firedRef = useRef(false);

	useEffect(() => {
		if (!enabled || firedRef.current) return;
		const key = `conversion:${jobId}:${eventType}`;
		try {
			if (sessionStorage.getItem(key)) return;
			sessionStorage.setItem(key, "1");
			firedRef.current = true;
		} catch {
			// sessionStorage unavailable (private browsing, etc.)
		}

		fetch(`/api/public/audit/${jobId}/events`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ eventType }),
		}).catch(() => {});
	}, [jobId, eventType, enabled]);
}
