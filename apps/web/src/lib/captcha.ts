const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) {
		console.warn("[captcha] TURNSTILE_SECRET_KEY not set, skipping verification");
		return true;
	}
	try {
		const res = await fetch(VERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ secret, response: token, remoteip: ip }),
		});
		const data = (await res.json()) as { success: boolean };
		return data.success === true;
	} catch {
		console.error("[captcha] Verification request failed");
		return false;
	}
}
