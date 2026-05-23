import { ApiError, SECURITY_HEADERS, errorResponse } from "@/lib/api-error";
import { hashIp } from "@/lib/hash-ip";
import { checkRateLimit, createRateLimitResponse } from "@/lib/rate-limit";
import { assertJsonContentType } from "@/lib/request-guards";
import { verifySharePassword } from "@/lib/share-password";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/public/report/[shareToken]/auth — validate password, set cookie
export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ shareToken: string }> },
) {
	try {
		const ctReject = assertJsonContentType(req);
		if (ctReject) return ctReject;

		const forwarded = req.headers.get("x-forwarded-for");
		const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

		const rate = await checkRateLimit(`share-auth:${hashIp(ip)}`, {
			maxRequests: 5,
			windowMs: 60_000,
		});
		if (!rate.allowed) return createRateLimitResponse(rate);

		const { shareToken } = await params;
		if (!shareToken || shareToken.length < 10) {
			throw new ApiError("INVALID_TOKEN", 400, "Ungültiger Share-Token.");
		}

		let body: { password?: unknown };
		try {
			body = await req.json();
		} catch {
			throw new ApiError("INVALID_BODY", 400, "Ungültiger Request-Body.");
		}
		if (typeof body.password !== "string") {
			throw new ApiError("INVALID_PASSWORD", 400, "Passwort erforderlich.");
		}

		const { db, reportShareQueries } = await import("@beacon/db");
		const share = await reportShareQueries.getActiveByToken(db, shareToken);
		if (!share || !share.passwordHash) {
			throw new ApiError("NOT_FOUND", 404, "Share nicht gefunden oder abgelaufen.");
		}

		if (!verifySharePassword(body.password, share.passwordHash)) {
			throw new ApiError("INVALID_PASSWORD", 401, "Falsches Passwort.");
		}

		// Set cookie scoped to this token's path (avoid cross-share leaks)
		const response = NextResponse.json({ ok: true }, { headers: SECURITY_HEADERS });
		response.cookies.set(`beacon_share_${shareToken.slice(0, 12)}`, "1", {
			httpOnly: true,
			sameSite: "strict",
			secure: process.env.NODE_ENV === "production",
			path: `/report/${shareToken}`,
			expires: share.expiresAt,
		});
		return response;
	} catch (err) {
		return errorResponse(err);
	}
}
