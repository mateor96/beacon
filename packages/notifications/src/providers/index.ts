import { ConsoleProvider } from "./console.js";
import { ResendProvider } from "./resend.js";
import type { EmailProvider } from "./types.js";

export { ConsoleProvider } from "./console.js";
export { ResendProvider } from "./resend.js";
export type { EmailMessage, EmailProvider, ProviderSendResult } from "./types.js";

/**
 * Create an email provider based on the current environment.
 * Returns ResendProvider when RESEND_API_KEY is set, otherwise ConsoleProvider (dev mode).
 */
export function createProvider(): EmailProvider {
	const apiKey = process.env.RESEND_API_KEY;

	if (apiKey) {
		return new ResendProvider(apiKey);
	}

	return new ConsoleProvider();
}
