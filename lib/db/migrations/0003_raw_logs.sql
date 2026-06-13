-- U7.2: Raw Logs Table
-- Immutable audit trail — NEVER delete rows, only append.

CREATE TABLE IF NOT EXISTS "raw_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "timestamp" timestamptz DEFAULT now() NOT NULL,
  "user_id" text NOT NULL DEFAULT 'anonymous',
  "user_message" text,
  "system_prompt_hash" text,
  "loaded_playbook" text,
  "loaded_routine" text,
  "knowledge_queries" jsonb DEFAULT '[]' NOT NULL,
  "tool_calls" jsonb DEFAULT '[]' NOT NULL,
  "reasoning" text,
  "final_response" text,
  "outcomes" jsonb DEFAULT '{}' NOT NULL,
  "annotations" jsonb DEFAULT '[]' NOT NULL,
  "knowledge_updates" jsonb DEFAULT '[]' NOT NULL,
  "raw_json" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_raw_logs_session" ON "raw_logs"("session_id");
CREATE INDEX IF NOT EXISTS "idx_raw_logs_timestamp" ON "raw_logs"("timestamp");
CREATE INDEX IF NOT EXISTS "idx_raw_logs_user_id" ON "raw_logs"("user_id");
