import { Resend } from "resend";
import type { EmailMessage, EmailProvider, ProviderSendResult } from "./types.js";

/**
 * Resend email provider for production use.
 */
export class ResendProvider implements EmailProvider {
	readonly name = "resend";
	private readonly client: Resend;

	constructor(apiKey: string) {
		this.client = new Resend(apiKey);
	}

	async send(message: EmailMessage): Promise<ProviderSendResult> {
		const { data, error } = await this.client.emails.send({
			from: message.from,
			to: message.to,
			subject: message.subject,
			html: message.html,
			text: message.text,
			headers: message.headers,
			tags: message.tags?.map((tag) => ({ name: tag, value: "true" })),
		});

		if (error) {
			throw new Error(`Resend API error: ${error.message}`);
		}

		if (!data?.id) {
			throw new Error("Resend API returned no message ID");
		}

		return { messageId: data.id, provider: this.name };
	}
}
