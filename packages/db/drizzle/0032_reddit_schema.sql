CREATE TABLE "reddit_subreddit_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"subscriber_count" bigint,
	"last_crawled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reddit_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"author" text,
	"score" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reddit_id" text NOT NULL,
	"post_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author" text,
	"score" integer DEFAULT 0 NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_mention_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_type" text NOT NULL,
	"mention_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"keyword_matched" text NOT NULL,
	"sentiment" text,
	"sentiment_score" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reddit_ai_citation_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mention_type" text NOT NULL,
	"mention_id" uuid NOT NULL,
	"citation_id" uuid NOT NULL,
	"confidence_score" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reddit_comments" ADD CONSTRAINT "reddit_comments_post_id_reddit_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."reddit_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_mention_brands" ADD CONSTRAINT "reddit_mention_brands_brand_id_monitoring_projects_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."monitoring_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reddit_ai_citation_links" ADD CONSTRAINT "reddit_ai_citation_links_citation_id_citations_id_fk" FOREIGN KEY ("citation_id") REFERENCES "public"."citations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_subreddit_meta_name_uniq" ON "reddit_subreddit_meta" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_posts_reddit_id_uniq" ON "reddit_posts" USING btree ("reddit_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_posts_subreddit_created" ON "reddit_posts" USING btree ("subreddit","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reddit_posts_created" ON "reddit_posts" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reddit_posts_discovered" ON "reddit_posts" USING btree ("discovered_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_comments_reddit_id_uniq" ON "reddit_comments" USING btree ("reddit_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_comments_post" ON "reddit_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_comments_created" ON "reddit_comments" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_mention_brands_uniq" ON "reddit_mention_brands" USING btree ("mention_type","mention_id","brand_id","keyword_matched");--> statement-breakpoint
CREATE INDEX "idx_reddit_mention_brands_brand" ON "reddit_mention_brands" USING btree ("brand_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_reddit_mention_brands_mention" ON "reddit_mention_brands" USING btree ("mention_type","mention_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_mention_brands_sentiment" ON "reddit_mention_brands" USING btree ("sentiment");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_reddit_ai_citation_links_uniq" ON "reddit_ai_citation_links" USING btree ("mention_type","mention_id","citation_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_ai_citation_links_citation" ON "reddit_ai_citation_links" USING btree ("citation_id");--> statement-breakpoint
CREATE INDEX "idx_reddit_ai_citation_links_mention" ON "reddit_ai_citation_links" USING btree ("mention_type","mention_id");
