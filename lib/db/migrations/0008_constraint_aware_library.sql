-- Phase 13.A: Constraint-Aware Library Frontmatter — extends library_skills + library_functions
-- Phase 13.B: Usage Logging — creates library_usage_logs immutable audit trail
-- Migration 0008: Skill Discovery + Marketplace + Refinement Loop foundation

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 13.A: Constraint columns for library_skills
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "library_skills"
  ADD COLUMN IF NOT EXISTS "context_tokens_estimated" integer,
  ADD COLUMN IF NOT EXISTS "typical_latency_ms" integer,
  ADD COLUMN IF NOT EXISTS "cost_per_invocation_usd" numeric(10,6),
  ADD COLUMN IF NOT EXISTS "dependencies" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "incompatible_with" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "optimal_for" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "suboptimal_for" jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "library_skills"."context_tokens_estimated" IS 'Estimated context tokens consumed when this skill is loaded. Backfilled from SKILL.md file size.';
COMMENT ON COLUMN "library_skills"."typical_latency_ms" IS 'Typical load latency in milliseconds. Estimated for existing, measured for adopted.';
COMMENT ON COLUMN "library_skills"."cost_per_invocation_usd" IS 'Estimated cost per invocation in USD, based on token count * model pricing.';
COMMENT ON COLUMN "library_skills"."dependencies" IS 'JSON array of required skills/functions this skill depends on.';
COMMENT ON COLUMN "library_skills"."incompatible_with" IS 'JSON array of skills/functions this skill conflicts with.';
COMMENT ON COLUMN "library_skills"."optimal_for" IS 'JSON array of playbook/domain names where this skill performs best.';
COMMENT ON COLUMN "library_skills"."suboptimal_for" IS 'JSON array of playbook/domain names where this skill underperforms.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 13.A: Constraint columns for library_functions
-- Note: library_functions already has "dependencies" column
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "library_functions"
  ADD COLUMN IF NOT EXISTS "context_tokens_estimated" integer,
  ADD COLUMN IF NOT EXISTS "typical_latency_ms" integer,
  ADD COLUMN IF NOT EXISTS "cost_per_invocation_usd" numeric(10,6),
  ADD COLUMN IF NOT EXISTS "incompatible_with" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "optimal_for" jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "suboptimal_for" jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "library_functions"."context_tokens_estimated" IS 'Estimated context tokens consumed when this function is loaded.';
COMMENT ON COLUMN "library_functions"."typical_latency_ms" IS 'Typical execution latency in milliseconds.';
COMMENT ON COLUMN "library_functions"."cost_per_invocation_usd" IS 'Estimated cost per invocation in USD.';
COMMENT ON COLUMN "library_functions"."incompatible_with" IS 'JSON array of function/connector names this function conflicts with.';
COMMENT ON COLUMN "library_functions"."optimal_for" IS 'JSON array of playbook/domain names where this function performs best.';
COMMENT ON COLUMN "library_functions"."suboptimal_for" IS 'JSON array of playbook/domain names where this function underperforms.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 13.B: library_usage_logs — Immutable usage audit trail
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_usage_logs" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id"      text,
  "skill_loaded"    text NOT NULL,
  "skill_type"      text NOT NULL DEFAULT 'connector',
  "playbook_routed_from" text,
  "success_marker"  boolean NOT NULL DEFAULT true,
  "tokens_actual"   integer,
  "latency_actual_ms" integer,
  "cost_actual_usd" numeric(10,6),
  "co_loaded_with"  jsonb DEFAULT '[]'::jsonb,
  "timestamp"       timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_usage_logs" IS 'Immutable audit trail of every skill/function load. Written by progressive disclosure loader on each load_skill/load_connector/load_function call.';
COMMENT ON COLUMN "library_usage_logs"."session_id" IS 'Chat session ID for grouping usage patterns.';
COMMENT ON COLUMN "library_usage_logs"."skill_loaded" IS 'Name of the skill/function/connector that was loaded.';
COMMENT ON COLUMN "library_usage_logs"."skill_type" IS 'connector | skill | function | playbook | workflow';
COMMENT ON COLUMN "library_usage_logs"."playbook_routed_from" IS 'Playbook name that triggered this load (for routing pattern analysis).';
COMMENT ON COLUMN "library_usage_logs"."success_marker" IS 'Whether the skill was used successfully (user did not retry/refine).';
COMMENT ON COLUMN "library_usage_logs"."co_loaded_with" IS 'JSON array of other skills loaded in the same session — for dependency detection.';
COMMENT ON COLUMN "library_usage_logs"."tokens_actual" IS 'Actual tokens consumed by this skill load.';
COMMENT ON COLUMN "library_usage_logs"."latency_actual_ms" IS 'Measured latency of this load in milliseconds.';

-- Indexes for refinement loop queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_timestamp ON "library_usage_logs"("timestamp");
CREATE INDEX IF NOT EXISTS idx_usage_logs_skill ON "library_usage_logs"("skill_loaded", "skill_type");
CREATE INDEX IF NOT EXISTS idx_usage_logs_session ON "library_usage_logs"("session_id");
CREATE INDEX IF NOT EXISTS idx_usage_logs_playbook ON "library_usage_logs"("playbook_routed_from");
CREATE INDEX IF NOT EXISTS idx_usage_logs_success ON "library_usage_logs"("success_marker", "timestamp");

COMMENT ON INDEX idx_usage_logs_timestamp IS 'Fast time-range queries for weekly refinement loop analysis.';
COMMENT ON INDEX idx_usage_logs_success IS 'Fast success/failure pattern queries grouped by time.';
