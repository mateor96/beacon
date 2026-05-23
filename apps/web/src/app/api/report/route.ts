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
import { ReportRequestSchema } from "@beacon/shared";
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

		const parseResult = ReportRequestSchema.safeParse(body);
		if (!parseResult.success) {
			const firstError = parseResult.error.issues[0]?.message ?? "Ungültige Eingabe";
			return NextResponse.json({ error: firstError }, { status: 400 });
		}
		const { scanId, regenerate, branding, accessToken: rawAccessToken } = parseResult.data;

		const rateLimitResult = await checkRateLimit(
			`report:${hashIp(ip)}`,
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

		const shouldRegenerate = regenerate || !!branding;

		if (scan.reportStatus === "completed" && !shouldRegenerate) {
			return NextResponse.json({
				scanId,
				status: "completed",
				message: "Report bereits vorhanden.",
			});
		}

		const queues = getQueues();
		const reportQueue = queues.report;
		const jobId = `report:${scanId}`;
		const existingJob = await reportQueue.getJob(jobId);
		if (existingJob) {
			const state = await existingJob.getState();
			if (
				state === "active" ||
				state === "waiting" ||
				state === "delayed" ||
				state === "prioritized" ||
				state === "waiting-children"
			) {
				return NextResponse.json(
					{ error: "Ein Report wird bereits für diesen Scan generiert." },
					{ status: 409 },
				);
			}
			await existingJob.remove();
		}

		await addJob(
			"report",
			{ scanId, format: "pdf" as const, branding, regenerate: shouldRegenerate || undefined },
			{ jobId },
		);

		await scanQueries.updateReportStatus(db, scanId, "pending", { jobId });

		return NextResponse.json(
			{ scanId, status: "processing" },
			{ status: 202, headers: rateLimitHeaders(rateLimitResult) },
		);
	} catch (_error) {
		return NextResponse.json(
			{ error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut." },
			{ status: 500 },
		);
	}
}
