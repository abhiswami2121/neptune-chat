-- Phase 10: Chat Resilience — Token Tracking, Checkpoints, and Artifact Metadata
-- Migration 0005 extends Message_v2, Chat, and creates chat_checkpoints
--
-- Schema changes:
--   1. Message_v2: ADD token_count, artifact_spec, artifact_model
--   2. Chat: ADD parent_chat_id, checkpoint_id
--   3. NEW TABLE: chat_checkpoints — for auto-checkpoint on >95% context window

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Message_v2 — Token tracking and artifact specification columns
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Message_v2"
  ADD COLUMN IF NOT EXISTS "token_count" integer,
  ADD COLUMN IF NOT EXISTS "artifact_spec" text,
  ADD COLUMN IF NOT EXISTS "artifact_model" varchar(64);

COMMENT ON COLUMN "Message_v2"."token_count" IS 'Estimated token count for this message (Phase 10-D token tracking)';
COMMENT ON COLUMN "Message_v2"."artifact_spec" IS 'Specification text used to generate the artifact (Phase 10-A)';
COMMENT ON COLUMN "Message_v2"."artifact_model" IS 'Model ID used to generate the artifact content';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Chat — Parent chain and checkpoint linkage for resume flow
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "parent_chat_id" uuid,
  ADD COLUMN IF NOT EXISTS "checkpoint_id" uuid;

COMMENT ON COLUMN "Chat"."parent_chat_id" IS 'Parent chat ID for forked/resumed conversations';
COMMENT ON COLUMN "Chat"."checkpoint_id" IS 'Last checkpoint ID this chat was resumed from';

-- Add foreign key for parent_chat_id (self-referential)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_parent_chat_id_fkey'
  ) THEN
    ALTER TABLE "Chat"
      ADD CONSTRAINT chat_parent_chat_id_fkey
      FOREIGN KEY ("parent_chat_id") REFERENCES "Chat"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. chat_checkpoints — Auto-checkpoint storage for long conversations
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "chat_checkpoints" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "chat_id" uuid NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "reason" varchar(32) NOT NULL DEFAULT 'manual',
  "token_count" integer NOT NULL DEFAULT 0,
  "usage_percent" integer NOT NULL DEFAULT 0,
  "conversation_summary" text,
  "message_ids" jsonb DEFAULT '[]'::jsonb,
  "model_id" varchar(64),
  "context_window" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE "chat_checkpoints" IS 'Auto-saved checkpoints when conversation approaches context limit (Phase 10-D)';
COMMENT ON COLUMN "chat_checkpoints"."reason" IS 'Reason for checkpoint: token_limit_95pct, manual, auto_periodic';
COMMENT ON COLUMN "chat_checkpoints"."usage_percent" IS 'Percentage of context window used at checkpoint time (0-100)';
COMMENT ON COLUMN "chat_checkpoints"."message_ids" IS 'JSON array of message IDs included in this checkpoint';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkpoints_chat ON chat_checkpoints(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_user ON chat_checkpoints(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkpoints_reason ON chat_checkpoints(reason);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Chat index for parent chain traversal
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_chat_parent ON "Chat"(parent_chat_id) WHERE parent_chat_id IS NOT NULL;
