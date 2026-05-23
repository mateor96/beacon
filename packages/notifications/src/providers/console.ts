import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailProvider, ProviderSendResult } from "./types.js";

/**
 * Console email provider for development and testing.
 * Logs the full message to stdout instead of sending it.
 */
export class ConsoleProvider implements EmailProvider {
	readonly name = "console";

	async send(message: EmailMessage): Promise<ProviderSendResult> {
		const messageId = randomUUID();

		console.log("─".repeat(60));
		console.log("[ConsoleProvider] Sending email");
		console.log(`  From:    ${message.from}`);
		console.log(`  To:      ${message.to.join(", ")}`);
		console.log(`  Subject: ${message.subject}`);
		if (message.tags?.length) {
			console.log(`  Tags:    ${message.tags.join(", ")}`);
		}
		console.log(`  ID:      ${messageId}`);
		console.log("─".repeat(60));
		console.log(message.text);
		console.log("─".repeat(60));

		return { messageId, provider: this.name };
	}
}
