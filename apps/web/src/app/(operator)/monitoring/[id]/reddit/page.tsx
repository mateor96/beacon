import { db, redditQueries } from "@beacon/db";
import { UuidSchema } from "@beacon/shared";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
	params: Promise<{ id: string }>;
}

const SENTIMENT_LABEL: Record<string, string> = {
	positive: "Positiv",
	neutral: "Neutral",
	negative: "Negativ",
};

export default async function RedditTab({ params }: Props) {
	const { id } = await params;
	if (!UuidSchema.safeParse(id).success) notFound();

	const redditConfigured = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);

	const [stats, subreddits, mentions] = await Promise.all([
		redditQueries.statsForBrand(db, id),
		redditQueries.listSubredditsForBrand(db, id),
		redditQueries.listMentionsForBrand(db, { brandId: id, limit: 20 }),
	]);

	const total = stats.reduce((sum, s) => sum + s.count, 0);

	return (
		<section className="space-y-6">
			<div>
				<h2 className="mb-1 text-xl font-semibold text-text">Reddit-Erwähnungen</h2>
				<p className="text-sm text-text-muted">
					Erwähnungen deiner Brand-Keywords auf Reddit, inkl. Sentiment und ob sie in AI-Antworten
					zitiert wurden.
				</p>
			</div>

			{!redditConfigured && (
				<div className="rounded-lg border border-border bg-surface-alt p-4 text-sm text-text-muted">
					Reddit-Discovery ist deaktiviert. Setze <code>REDDIT_CLIENT_ID</code> und{" "}
					<code>REDDIT_CLIENT_SECRET</code> und starte den Worker neu, um Erwähnungen zu erfassen.
				</div>
			)}

			{total === 0 ? (
				<div className="rounded-lg border border-border bg-surface p-12 text-center text-text-muted">
					Noch keine Reddit-Erwähnungen erfasst.
				</div>
			) : (
				<>
					<div className="grid gap-4 sm:grid-cols-3">
						{(["positive", "neutral", "negative"] as const).map((key) => {
							const count = stats.find((s) => s.sentiment === key)?.count ?? 0;
							return (
								<div key={key} className="rounded-lg border border-border bg-surface p-4">
									<p className="text-xs uppercase tracking-wide text-text-muted">
										{SENTIMENT_LABEL[key]}
									</p>
									<p className="mt-1 text-2xl font-bold text-text">{count}</p>
								</div>
							);
						})}
					</div>

					{subreddits.length > 0 && (
						<section className="rounded-lg border border-border bg-surface p-5">
							<h3 className="mb-3 text-sm font-semibold text-text">Top Subreddits</h3>
							<ul className="flex flex-wrap gap-2">
								{subreddits.map((s) => (
									<li
										key={s.subreddit}
										className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
									>
										r/{s.subreddit} · {s.count}
									</li>
								))}
							</ul>
						</section>
					)}

					<section>
						<h3 className="mb-3 text-sm font-semibold text-text">Neueste Erwähnungen</h3>
						<ul className="divide-y divide-border rounded-lg border border-border bg-white">
							{mentions.map((m) => {
								const text = m.post?.title ?? m.comment?.body ?? "(kein Text)";
								const url = m.post?.url ?? m.comment?.url ?? null;
								const subreddit = m.post?.subreddit;
								return (
									<li key={m.mention.id} className="px-4 py-3 text-sm">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate text-text" title={text}>
													{url ? (
														<a
															href={url}
															target="_blank"
															rel="noopener noreferrer"
															className="hover:text-primary hover:underline"
														>
															{text}
														</a>
													) : (
														text
													)}
												</p>
												<p className="mt-0.5 text-xs text-text-muted">
													{subreddit ? `r/${subreddit} · ` : ""}
													{m.mention.sentiment ? SENTIMENT_LABEL[m.mention.sentiment] : "—"}
												</p>
											</div>
											{m.hasAiCitation && (
												<span className="shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
													AI-zitiert
												</span>
											)}
										</div>
									</li>
								);
							})}
						</ul>
					</section>
				</>
			)}
		</section>
	);
}
