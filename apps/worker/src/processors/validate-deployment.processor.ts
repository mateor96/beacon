/**
 * Post-deployment validation processor (#300).
 *
 * After a fix is deployed, validates that the content is actually live
 * on the user's site. Retries on failure (5 min backoff) to handle CDN
 * propagation delays.
 */

import type { ValidateDeploymentJobData, ValidateDeploymentJobResult } from "@beacon/queue";
import type { Job } from "bullmq";
import { createJobLogger } from "../lib/logger.js";

/** Resolve the full URL to validate based on fix type. */
function resolveValidationUrl(siteUrl: string, fixType: string): string {
	const base = siteUrl.replace(/\/+$/, "");
	switch (fixType) {
		case "llms_txt":
			return `${base}/llms.txt`;
		case "agents_md":
			return `${base}/agents.md`;
		case "json_ld":
			return base;
		default:
			return base;
	}
}

/** Strip HTML wrappers like <pre> tags and normalize whitespace for comparison. */
function normalizeText(raw: string): string {
	return raw
		.replace(/<\/?pre[^>]*>/gi, "")
		.replace(/\r\n/g, "\n")
		.replace(/[ \t]+/g, " ")
		.trim();
}

/** Extract all JSON-LD script contents from an HTML page. */
function extractJsonLdScripts(html: string): unknown[] {
	const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
	const results: unknown[] = [];
	for (;;) {
		const match = regex.exec(html);
		if (match === null) break;
		try {
			results.push(JSON.parse(match[1]));
		} catch {
			// Skip malformed JSON
		}
	}
	return results;
}

/** Deep-compare two JSON values. */
function deepEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export async function processValidateDeployment(
	job: Job<ValidateDeploymentJobData, ValidateDeploymentJobResult>,
): Promise<ValidateDeploymentJobResult> {
	const { deploymentAttemptId, fixId, fixType, expectedContent, siteUrl } = job.data;
	const log = createJobLogger({
		queue: "validate-deployment",
		jobId: job.id ?? "unknown",
		scanId: deploymentAttemptId,
		correlationId: deploymentAttemptId,
	});

	log.info("Validating deployment", { deploymentAttemptId, fixId, fixType, siteUrl });

	const url = resolveValidationUrl(siteUrl, fixType);

	// Fetch the live URL with a 15s timeout
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15_000);

	let response: Response;
	try {
		response = await fetch(url, {
			signal: controller.signal,
			headers: { "User-Agent": "Beacon-Validator/1.0" },
		});
	} catch (err) {
		clearTimeout(timeout);
		log.error("Fetch failed", { url, error: err instanceof Error ? err.message : String(err) });
		throw new Error(`Validierung fehlgeschlagen: ${url} nicht erreichbar`);
	} finally {
		clearTimeout(timeout);
	}

	const checksRun: string[] = [];
	const checksPassed: string[] = [];
	const checksFailed: string[] = [];
	const details: Record<string, string> = {};

	if (fixType === "json_ld") {
		// JSON-LD: parse page HTML and find matching script tags
		checksRun.push("json_ld_present", "json_ld_match");

		if (!response.ok) {
			checksFailed.push("json_ld_present", "json_ld_match");
			details.json_ld_present = `HTTP ${response.status}`;
		} else {
			const html = await response.text();
			const scripts = extractJsonLdScripts(html);

			if (scripts.length === 0) {
				checksFailed.push("json_ld_present", "json_ld_match");
				details.json_ld_present = "Keine JSON-LD Script-Tags gefunden";
			} else {
				checksPassed.push("json_ld_present");
				details.json_ld_present = `${scripts.length} Script-Tag(s) gefunden`;

				let expectedParsed: unknown;
				try {
					expectedParsed = JSON.parse(expectedContent);
				} catch {
					checksFailed.push("json_ld_match");
					details.json_ld_match = "Erwarteter Inhalt ist kein gueltiges JSON";
				}

				if (expectedParsed !== undefined) {
					const hasMatch = scripts.some((s) => deepEqual(s, expectedParsed));
					if (hasMatch) {
						checksPassed.push("json_ld_match");
						details.json_ld_match = "Exakte Uebereinstimmung";
					} else {
						checksFailed.push("json_ld_match");
						details.json_ld_match = "Inhalt weicht ab";
					}
				}
			}
		}
	} else {
		// llms_txt / agents_md: compare text content
		checksRun.push("content_present", "content_match");

		if (!response.ok) {
			checksFailed.push("content_present", "content_match");
			details.content_present = `HTTP ${response.status}`;
		} else {
			const body = await response.text();
			checksPassed.push("content_present");
			details.content_present = "Datei gefunden";

			const normalizedBody = normalizeText(body);
			const normalizedExpected = normalizeText(expectedContent);

			if (normalizedBody === normalizedExpected) {
				checksPassed.push("content_match");
				details.content_match = "Exakte Uebereinstimmung";
			} else {
				checksFailed.push("content_match");
				details.content_match = "Inhalt weicht ab";
			}
		}
	}

	// Determine status
	let status: "pass" | "partial" | "fail";
	if (checksFailed.length === 0) {
		status = "pass";
	} else if (checksPassed.length > 0) {
		status = "partial";
	} else {
		status = "fail";
	}

	// Record validation in DB
	const { db, fixQueries } = await import("@beacon/db");
	const { id: validationId } = await fixQueries.recordValidation(db, {
		deploymentId: deploymentAttemptId,
		scanId: null,
		status,
		results: { checksRun, checksPassed, checksFailed, details },
	});

	log.info("Validation complete", { deploymentAttemptId, status, validationId });

	// On "fail": throw so BullMQ retries (CDN propagation)
	if (status === "fail") {
		throw new Error(`Validierung fehlgeschlagen fuer ${fixType}: ${checksFailed.join(", ")}`);
	}

	return { deploymentAttemptId, status, validationId };
}
