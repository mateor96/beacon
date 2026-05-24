-- v0.4 (#39): instance-scoped AI provider API keys, stored as AES-256-GCM
-- envelopes in "encrypted_value". One row per engine; a present row overrides
-- the corresponding env var at runtime (no restart needed). Never plaintext.

CREATE TABLE IF NOT EXISTS "provider_keys" (
	"engine" text PRIMARY KEY NOT NULL,
	"encrypted_value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
