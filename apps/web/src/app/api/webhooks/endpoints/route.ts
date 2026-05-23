import { randomBytes } from "node:crypto";
import { hashIp } from "@/lib/hash-ip";
import {
	checkRateLimit,
	createRateLimitResponse,
	getRateLimitConfig,
	rateLimitHeaders,
} from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { WEBHOOK_EVENT_NAMES } from "@beacon/api-sdk";
import { db, webhookQueries } from "@beacon/db";
import { encryptCmsCredentials, webhookSecretAad } from "@beacon/shared/crypto-aes-gcm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateEndpointSchema = z.object({
	url: z.string().trim().url("URL muss eine gültige URL sein").max(2048),
	events: z
		.array(z.enum(WEBHOOK_EVENT_NAMES as [string, ...string[]]))
		.min(1, "Mindestens ein Event-Typ ist erforderlich"),
});

function generateSecret(): string {
	return `whsec_${randomBytes(32).toString("hex")}`;
}

export async function GET() {
	const rows = await webhookQueries.listAll(db);
	return NextResponse.json({
		endpoints: rows.map((e) => ({
			id: e.id,
			url: e.url,
			events: e.events,
			active: e.active,
			createdAt: e.createdAt.toISOString(),
			updatedAt: e.updatedAt.toISOString(),
		})),
	});
}

export async function POST(request: Request) {
	const ctReject = assertJsonContentType(request);
	if (ctReject) return ctReject;

	const forwarded = request.headers.get("x-forwarded-for");
	const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
	const rate = await checkRateLimit(
		`webhook-create:${hashIp(ip)}`,
		getRateLimitConfig("mutation", "anonymous"),
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

	const parsed = CreateEndpointSchema.safeParse(body);
	if (!parsed.success) {
		const first = parsed.error.issues[0]?.message ?? "Ungültige Eingabe";
		return NextResponse.json({ error: first }, { status: 400 });
	}
	const { url, events } = parsed.data;

	// Generate + encrypt the secret. Two-step (encrypt empty placeholder
	// just so we have an id) would also work; instead we pre-generate the
	// id by inserting first with a placeholder ciphertext, then UPDATE.
	const placeholder = encryptCmsCredentials({ plaintext: "PENDING", aad: "placeholder" });
	const inserted = await webhookQueries.create(db, {
		url,
		encryptedSecret: placeholder,
		events,
	});

	const secret = generateSecret();
	const envelope = encryptCmsCredentials({
		plaintext: secret,
		aad: webhookSecretAad(inserted.id),
	});
	await webhookQueries.update(db, inserted.id, {});
	// We need to update encryptedSecret, but `update()` only takes url/events/active.
	// Drop down to a direct query to set encryptedSecret.
	const { sql } = await import("drizzle-orm");
	await db.execute(
		sql`UPDATE webhook_endpoints SET encrypted_secret = ${envelope} WHERE id = ${inserted.id}`,
	);

	return NextResponse.json(
		{
			id: inserted.id,
			url,
			events,
			active: true,
			// Plaintext returned EXACTLY once. Operator must store this — it
			// is never returned again on GET / list endpoints.
			secret,
		},
		{ status: 201, headers: rateLimitHeaders(rate) },
	);
}
