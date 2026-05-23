import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType, assertSameOrigin } from "@/lib/request-guards";
import { getScanAccess, normalizeAccessToken } from "@/lib/scan-access";
import { db, scanQueries } from "@beacon/db";
import { addJob, getQueues } from "@beacon/queue";
import { AnalyzeRequestSchema } from "@beacon/shared";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const originReject = assertSameOrigin(request);
		if (originReject) return originReject;

		const ctReject = assertJsonContentType(request);
		if (ctReject) return ctReject;

		const forwarded = request.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
		}

		const parseResult = AnalyzeRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { scanId, type, accessToken: rawAccessToken } = parseResult.data;

		const rateLimitResult = await checkRateLimit(
			`analyze:${hashIp(ip)}`,
			getRateLimitConfig("mutation", "anonymous"),
		);
		if (!rateLimitResult.allowed) {
			return createRateLimitResponse(rateLimitResult);
		}

		const scan = await scanQueries.getById(db, scanId);
		if (!scan) {
			return NextResponse.json({ error: "Scan nicht gefunden." }, { status: 404 });
		}

		const accessToken = normalizeAccessToken(rawAccessToken);
		const accessMode = getScanAccess(scan, { viewerUserId: null, accessToken });
		if (accessMode !== "owner") {
			return NextResponse.json({ error: "Scan nicht gefunden." }, { status: 404 });
		}

		if (scan.status !== "completed") {
			return NextResponse.json({ error: "Der Scan wird noch verarbeitet." }, { status: 409 });
		}

		if (!scan.htmlContent) {
			return NextResponse.json({ error: "Der Scan enthält keinen HTML-Inhalt." }, { status: 409 });
		}

		const typesToRun: ("semantic" | "citation")[] =
			type === "both" ? ["semantic", "citation"] : [type];

		const analysisState = await scanQueries.getAnalysisById(db, scanId);
		const allDone = typesToRun.every((t) => {
			if (t === "semantic") return analysisState?.aiAnalysisStatus === "completed";
			return analysisState?.citationAnalysisStatus === "completed";
		});

		if (allDone) {
			return NextResponse.json({
				scanId,
				status: "completed",
				message: "Analyse bereits abgeschlossen.",
			});
		}

		const queues = getQueues();
		const analysisQueue = queues.analysis;

		for (const t of typesToRun) {
			const jobId = `analysis:${scanId}:${t}`;
			const statusCol =
				t === "semantic" ? analysisState?.aiAnalysisStatus : analysisState?.citationAnalysisStatus;

			if (statusCol === "processing") {
				const existingJob = await analysisQueue.getJob(jobId);
				if (existingJob) {
					const state = await existingJob.getState();
					if (state === "active" || state === "waiting" || state === "delayed") {
						return NextResponse.json(
							{ error: "Eine Analyse läuft bereits für diesen Scan." },
							{ status: 409 },
						);
					}
				}
			}
		}

		const typesToEnqueue = typesToRun.filter((t) => {
			const statusCol =
				t === "semantic" ? analysisState?.aiAnalysisStatus : analysisState?.citationAnalysisStatus;
			return statusCol !== "completed";
		});

		const enqueuedJobIds: string[] = [];
		try {
			for (const t of typesToEnqueue) {
				const jobId = `analysis:${scanId}:${t}`;
				await addJob("analysis", { scanId, type: t }, { jobId });
				enqueuedJobIds.push(jobId);
			}
		} catch {
			for (const jobId of enqueuedJobIds) {
				await analysisQueue.remove(jobId).catch(() => {});
			}
			return NextResponse.json(
				{ error: "Analyse konnte nicht gestartet werden. Bitte versuchen Sie es später erneut." },
				{ status: 503 },
			);
		}

		for (const t of typesToEnqueue) {
			await scanQueries.updateAnalysisStatus(db, scanId, t, "pending");
		}

		return NextResponse.json(
			{ scanId, status: "processing", types: [...typesToEnqueue] },
			{ status: 202, headers: rateLimitHeaders(rateLimitResult) },
		);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
