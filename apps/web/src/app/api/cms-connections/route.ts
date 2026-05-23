import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { db, fixQueries } from "@beacon/db";
import { CreateCmsConnectionSchema } from "@beacon/shared";
import type { CmsCredentialsPlaintext } from "@beacon/shared/types";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Instance-scoped CMS connections (v0.2 #5). Credentials are AES-GCM-
 * encrypted on the way in via the AAD bound to the row id. The operator
 * who deploys Beacon owns these — there is no per-user isolation.
 */

export async function GET() {
	const rows = await fixQueries.listCmsConnections(db);
	return NextResponse.json({
		connections: rows.map((c) => ({
			id: c.id,
			cmsType: c.cmsType,
			siteUrl: c.siteUrl,
			label: c.label,
			isActive: c.isActive,
			createdAt: c.createdAt.toISOString(),
			updatedAt: c.updatedAt.toISOString(),
			lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
		})),
	});
}

export async function POST(request: Request) {
	const ctReject = assertJsonContentType(request);
	if (ctReject) return ctReject;

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`cms-create:${hashIp(ip)}`,
		getRateLimitConfig("cms", "anonymous"),
	);
	if (!rate.allowed) return createRateLimitResponse(rate);

	if (!process.env.CMS_CREDENTIALS_KEY) {
		return NextResponse.json(
			{ error: "CMS_CREDENTIALS_KEY ist nicht konfiguriert." },
			{ status: 500 },
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
	}

	const parsed = CreateCmsConnectionSchema.safeParse(body);
	if (!parsed.success) {
		const first = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
		return NextResponse.json({ error: first }, { status: 400 });
	}

	const data = parsed.data;
	let credentials: CmsCredentialsPlaintext;
	if (data.cmsType === "wordpress") {
		credentials = { cms: "wordpress", ...data.credentials };
	} else if (data.cmsType === "shopify") {
		credentials = {
			cms: "shopify",
			shopDomain: data.credentials.shopDomain,
			accessToken: data.credentials.accessToken,
			apiVersion: data.credentials.apiVersion ?? "2024-10",
		};
	} else {
		credentials = {
			cms: "webflow",
			siteId: data.credentials.siteId,
			apiToken: data.credentials.apiToken,
		};
	}

	const result = await fixQueries.createCmsConnection(db, {
		cmsType: data.cmsType,
		siteUrl: data.siteUrl,
		label: data.label,
		credentials,
	});

	return NextResponse.json(
		{ id: result.id, cmsType: data.cmsType, siteUrl: data.siteUrl, label: data.label ?? null },
		{ status: 201, headers: rateLimitHeaders(rate) },
	);
}
