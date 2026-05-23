CREATE TABLE "ai_competitor_benchmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"competitor_name" text NOT NULL,
	"ai_engine" text NOT NULL,
	"share_of_voice" real NOT NULL,
	"avg_sentiment" real NOT NULL,
	"avg_rank" real NOT NULL,
	"benchmarked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"mention_type" text NOT NULL,
	"position" integer,
	"context_text" text,
	"sentiment" text,
	"mentioned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"ai_engine" text NOT NULL,
	"rank_position" integer NOT NULL,
	"competitor_name" text,
	"query_text" text NOT NULL,
	"ranked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_sentiment_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"sentiment_score" real NOT NULL,
	"positive_count" integer DEFAULT 0 NOT NULL,
	"neutral_count" integer DEFAULT 0 NOT NULL,
	"negative_count" integer DEFAULT 0 NOT NULL,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"brand_name" text NOT NULL,
	"ai_engine" text NOT NULL,
	"query_text" text NOT NULL,
	"raw_response" jsonb NOT NULL,
	"cost_cents" integer,
	"queried_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_source_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"is_own_domain" boolean DEFAULT false NOT NULL,
	"attributed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_competitor_benchmarks" ADD CONSTRAINT "ai_competitor_benchmarks_snapshot_id_ai_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_competitor_benchmarks" ADD CONSTRAINT "ai_competitor_benchmarks_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_mentions" ADD CONSTRAINT "ai_mentions_snapshot_id_ai_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_mentions" ADD CONSTRAINT "ai_mentions_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rankings" ADD CONSTRAINT "ai_rankings_snapshot_id_ai_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rankings" ADD CONSTRAINT "ai_rankings_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sentiment_scores" ADD CONSTRAINT "ai_sentiment_scores_snapshot_id_ai_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_sentiment_scores" ADD CONSTRAINT "ai_sentiment_scores_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_snapshots" ADD CONSTRAINT "ai_snapshots_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_attributions" ADD CONSTRAINT "ai_source_attributions_mention_id_ai_mentions_id_fk" FOREIGN KEY ("mention_id") REFERENCES "public"."ai_mentions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source_attributions" ADD CONSTRAINT "ai_source_attributions_project_id_monitoring_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_competitor_benchmarks_project_competitor_benchmarked" ON "ai_competitor_benchmarks" USING btree ("project_id","competitor_name","benchmarked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_competitor_benchmarks_snapshot" ON "ai_competitor_benchmarks" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_ai_mentions_project_brand_mentioned" ON "ai_mentions" USING btree ("project_id","brand_name","mentioned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_mentions_snapshot" ON "ai_mentions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_ai_mentions_mentioned" ON "ai_mentions" USING btree ("mentioned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_rankings_project_brand_engine_ranked" ON "ai_rankings" USING btree ("project_id","brand_name","ai_engine","ranked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_rankings_snapshot" ON "ai_rankings" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_ai_sentiment_scores_project_brand_scored" ON "ai_sentiment_scores" USING btree ("project_id","brand_name","scored_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_sentiment_scores_snapshot" ON "ai_sentiment_scores" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "idx_ai_snapshots_project_queried" ON "ai_snapshots" USING btree ("project_id","queried_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_snapshots_brand_engine_queried" ON "ai_snapshots" USING btree ("brand_name","ai_engine","queried_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_source_attributions_mention" ON "ai_source_attributions" USING btree ("mention_id");--> statement-breakpoint
CREATE INDEX "idx_ai_source_attributions_project_attributed" ON "ai_source_attributions" USING btree ("project_id","attributed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_ai_source_attributions_domain" ON "ai_source_attributions" USING btree ("domain");