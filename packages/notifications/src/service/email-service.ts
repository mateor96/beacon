import { addJob } from "@beacon/queue";
import type { EmailJobData } from "@beacon/queue";
import type { EmailMessage, EmailProvider } from "../providers/types.js";
import { templates } from "../templates/index.js";
import { wrapInLayout } from "../templates/layout.js";
import type { TemplateDataMap, TemplateName } from "../templates/types.js";
import { mintUnsubscribeToken } from "../unsubscribe/token.js";

export type EmailCategory = "transactional" | "alert" | "digest" | "report" | "marketing";

export interface EmailServiceConfig {
	provider: EmailProvider;
	defaultFrom: string;
	unsubscribeSecret: string;
	appBaseUrl: string;
}

export interface SendEmailOptions<T extends TemplateName> {
	template: T;
	to: string | string[];
	data: TemplateDataMap[T];
	userId?: string;
	idempotencyKey?: string;
	scheduledAt?: Date;
	category?: EmailCategory;
}

export interface EmailSendResult {
	emailLogId: string;
	status: "queued" | "suppressed" | "deduplicated";
}

export class EmailService {
	private readonly provider: EmailProvider;
	private readonly defaultFrom: string;
	private readonly appBaseUrl: string;

	constructor(private readonly config: EmailServiceConfig) {
		this.provider = config.provider;
		this.defaultFrom = config.defaultFrom;
		this.appBaseUrl = config.appBaseUrl;
	}

	async send<T extends TemplateName>(options: SendEmailOptions<T>): Promise<EmailSendResult> {
		const { db, emailQueries } = await import("@beacon/db");

		const {
			template,
			to,
			data,
			userId,
			idempotencyKey,
			scheduledAt,
			category = "transactional",
		} = options;

		// 1. Normalize recipients to array
		const recipients = Array.isArray(to) ? to : [to];

		// 2. Deduplication check via idempotency key
		if (idempotencyKey) {
			const existing = await emailQueries.getEmailLogByIdempotencyKey(db, idempotencyKey);
			if (existing) {
				return { emailLogId: existing.id, status: "deduplicated" };
			}
		}

		// 3. Check user suppression preferences (non-transactional only)
		if (userId && category !== "transactional") {
			const preference = await emailQueries.getUserEmailPreference(db, userId, category);
			if (preference && !preference.enabled) {
				const suppressed = await emailQueries.insertEmailLog(db, {
					userId,
					recipientEmail: recipients.join(", "),
					template,
					category,
					subject: `[suppressed] ${template}`,
					idempotencyKey: idempotencyKey ?? null,
					status: "suppressed",
				});
				return {
					emailLogId: suppressed?.id ?? "unknown",
					status: "suppressed",
				};
			}
		}

		// 4. Look up template renderer
		const renderer = templates[template];
		if (!renderer) {
			throw new Error(`Unknown email template: ${template}`);
		}

		// 5. Generate unsubscribe URL for non-transactional emails
		let unsubscribeUrl: string | undefined;
		if (userId && category !== "transactional") {
			const token = mintUnsubscribeToken(userId, category);
			unsubscribeUrl = `${this.appBaseUrl}/api/email/unsubscribe?token=${token}`;
		}

		// 6. Render template
		const rendered = renderer(data, unsubscribeUrl ?? "");

		// 7. Wrap HTML in layout
		const html = wrapInLayout(rendered.html, unsubscribeUrl);

		// 8. Insert email_log with status "queued"
		const emailLogRow = await emailQueries.insertEmailLog(db, {
			userId: userId ?? null,
			recipientEmail: recipients.join(", "),
			template,
			category,
			subject: rendered.subject,
			idempotencyKey: idempotencyKey ?? null,
			status: "queued",
			scheduledFor: scheduledAt ?? null,
		});

		const emailLogId = emailLogRow?.id ?? "unknown";

		// 9. Compute BullMQ delay from scheduledAt
		let delay: number | undefined;
		if (scheduledAt) {
			const delayMs = scheduledAt.getTime() - Date.now();
			if (delayMs > 0) {
				delay = delayMs;
			}
		}

		// 10. Build job data and enqueue
		const jobData: EmailJobData = {
			emailLogId,
			to: recipients,
			from: this.defaultFrom,
			subject: rendered.subject,
			html,
			text: rendered.text,
			...(unsubscribeUrl && {
				headers: { "List-Unsubscribe": `<${unsubscribeUrl}>` },
			}),
			tags: [template, category],
		};

		await addJob("email", jobData, {
			jobId: idempotencyKey,
			delay,
		});

		// 11. Return result
		return { emailLogId, status: "queued" };
	}
}
