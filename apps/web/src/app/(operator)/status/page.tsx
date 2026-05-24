import { CronHealthPanel } from "@/components/settings/cron-health";
import { type DlqEntry, DlqPanel, type DlqQueueCount } from "@/components/settings/dlq-panel";
import { type EmailLogEntry, EmailLogPanel } from "@/components/settings/email-log";
import { StatusBadge } from "@/components/settings/primitives";
import { type ProviderStatus, ProviderStatusPanel } from "@/components/settings/provider-status";
import { QueueHealthPanel } from "@/components/settings/queue-health";
import { fetchCronHealth } from "@/lib/worker-client";
import { ChatGptProvider, ClaudeProvider, GeminiProvider, PerplexityProvider } from "@beacon/ai";
import { db, deadLetterJobQueries, emailQueries, providerKeyQueries } from "@beacon/db";
import { type AllQueueMetrics, getQueueMetrics } from "@beacon/queue";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Status & Health",
};

const PROVIDER_META: Record<string, { label: string; envVar: string }> = {
	claude: { label: "Claude (Anthropic)", envVar: "ANTHROPIC_API_KEY" },
	chatgpt: { label: "ChatGPT (OpenAI)", envVar: "OPENAI_API_KEY" },
	perplexity: { label: "Perplexity", envVar: "PERPLEXITY_API_KEY" },
	gemini: { label: "Gemini (Google)", envVar: "GOOGLE_AI_API_KEY" },
};

function readProviderStatus(dbKeys: Partial<Record<string, string>>): ProviderStatus[] {
	const instances = [
		new ClaudeProvider(dbKeys.claude),
		new ChatGptProvider(dbKeys.chatgpt),
		new PerplexityProvider(dbKeys.perplexity),
		new GeminiProvider(dbKeys.gemini),
	];
	return instances.map((p) => ({
		label: PROVIDER_META[p.engine]?.label ?? p.engine,
		envVar: PROVIDER_META[p.engine]?.envVar ?? "",
		configured: p.isConfigured(),
	}));
}

async function readQueueMetrics(): Promise<AllQueueMetrics | null> {
	try {
		return await getQueueMetrics();
	} catch {
		return null;
	}
}

async function readDlq(): Promise<{ counts: DlqQueueCount[]; recent: DlqEntry[]; error: boolean }> {
	try {
		const [counts, recent] = await Promise.all([
			deadLetterJobQueries.countByQueue(db),
			deadLetterJobQueries.getAll(db, { limit: 15 }),
		]);
		return { counts, recent: recent as DlqEntry[], error: false };
	} catch {
		return { counts: [], recent: [], error: true };
	}
}

async function readEmails(): Promise<{ entries: EmailLogEntry[]; error: boolean }> {
	try {
		const rows = await emailQueries.listRecentEmailLogs(db, { limit: 15 });
		return { entries: rows as EmailLogEntry[], error: false };
	} catch {
		return { entries: [], error: true };
	}
}

// Non-provider env keys worth surfacing (presence only — never the value).
const EXTRA_KEYS: { label: string; envVar: string }[] = [
	{ label: "Reddit Client-ID", envVar: "REDDIT_CLIENT_ID" },
	{ label: "Reddit Client-Secret", envVar: "REDDIT_CLIENT_SECRET" },
	{ label: "Instance-API-Token", envVar: "BEACON_API_TOKEN" },
	{ label: "Resend (E-Mail-Versand)", envVar: "RESEND_API_KEY" },
];

export default async function StatusPage() {
	const dbKeys = await providerKeyQueries.resolveProviderKeys(db).catch(() => ({}));
	const providers = readProviderStatus(dbKeys);
	const [queueMetrics, dlq, emails, cron] = await Promise.all([
		readQueueMetrics(),
		readDlq(),
		readEmails(),
		fetchCronHealth(),
	]);
	const extraKeys = EXTRA_KEYS.map((k) => ({ ...k, set: !!process.env[k.envVar] }));

	return (
		<main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
			<h1 className="text-3xl font-bold text-text">Status &amp; Health</h1>
			<p className="mt-2 text-text-muted">
				Konfigurierte Keys, Queue-Health, Dead-Letter-Queue, Cron-Läufe und E-Mail-Log dieser
				Instanz. Alle Werte sind read-only — Konfiguration läuft ausschließlich über env-Variablen.
			</p>

			<div className="mt-8 space-y-6">
				<ProviderStatusPanel providers={providers} />

				<section className="rounded-lg border border-border bg-surface p-5">
					<h2 className="text-lg font-semibold text-text">Weitere Keys</h2>
					<p className="mt-1 text-sm text-text-muted">
						Nur Anwesenheit wird angezeigt — niemals der Wert.
					</p>
					<ul className="mt-4 divide-y divide-border">
						{extraKeys.map((k) => (
							<li key={k.envVar} className="flex items-center justify-between gap-3 py-3">
								<div className="min-w-0">
									<p className="font-medium text-text">{k.label}</p>
									<code className="text-xs text-text-muted">{k.envVar}</code>
								</div>
								{k.set ? (
									<StatusBadge tone="success">Gesetzt</StatusBadge>
								) : (
									<StatusBadge tone="muted">Nicht gesetzt</StatusBadge>
								)}
							</li>
						))}
					</ul>
				</section>

				<QueueHealthPanel metrics={queueMetrics} />
				<CronHealthPanel entries={cron} />
				<DlqPanel counts={dlq.counts} recent={dlq.recent} error={dlq.error} />
				<EmailLogPanel entries={emails.entries} error={emails.error} />
			</div>
		</main>
	);
}
