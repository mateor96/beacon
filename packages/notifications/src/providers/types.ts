export interface EmailMessage {
	from: string;
	to: string[];
	subject: string;
	html: string;
	text: string;
	headers?: Record<string, string>;
	tags?: string[];
}

export interface ProviderSendResult {
	messageId: string;
	provider: string;
}

export interface EmailProvider {
	readonly name: string;
	send(message: EmailMessage): Promise<ProviderSendResult>;
}
