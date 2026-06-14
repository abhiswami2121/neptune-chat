-- Phase 12: Relational Graph + Progressive Disclosure — Library Graph Tables
-- Migration 0007 creates 6 library_* tables forming the relational graph layer.
--
-- Schema:
--   library_connectors  — integration packs (NMI, Slack, GitHub, etc.)
--   library_skills      — connector skill docs (SKILL.md from connectors/*/)
--   library_functions   — domain functions (from skills/functions/*/)
--   library_playbooks   — domain playbook SOPs (from playbooks/*/)
--   library_workflows   — durable workflows (from workflows/*.workflow.ts)
--   library_edges       — relationships between nodes (uses, routes_to, exposes, etc.)
--
-- Edges are computed from file content during backfill, not duplicated in markdown.
-- Single source of truth: skills/registry.json + connectors/*/SKILL.md + playbooks/*/playbook-*.md

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. library_connectors — Integrated external APIs / services
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_connectors" (
  "name"         text PRIMARY KEY,
  "domain"       text NOT NULL DEFAULT '',
  "mcp_enabled"  boolean NOT NULL DEFAULT false,
  "description"  text NOT NULL DEFAULT '',
  "primary_domain" text,
  "also_in"      jsonb DEFAULT '[]'::jsonb,
  "dependencies" jsonb DEFAULT '[]'::jsonb,
  "tools"        integer NOT NULL DEFAULT 0,
  "tool_names"   jsonb DEFAULT '[]'::jsonb,
  "version"      text NOT NULL DEFAULT '1.0.0',
  "file_path"    text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_connectors" IS 'Integration packs — external API wrappers with tool manifests (Phase 12 relational graph)';
COMMENT ON COLUMN "library_connectors"."domain" IS 'Legacy domain field. Prefer primary_domain + also_in for multi-domain connectors.';
COMMENT ON COLUMN "library_connectors"."also_in" IS 'JSON array of secondary domains this connector serves.';
COMMENT ON COLUMN "library_connectors"."tool_names" IS 'JSON array of tool/function names exposed by this connector.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. library_skills — Per-connector skill docs (connectors/*/SKILL.md)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_skills" (
  "name"            text NOT NULL,
  "type"            text NOT NULL DEFAULT 'connector',
  "connector_name"  text REFERENCES "library_connectors"("name") ON DELETE SET NULL,
  "description"     text NOT NULL DEFAULT '',
  "file_path"       text,
  "content"         text,
  "version"         text NOT NULL DEFAULT '1.0.0',
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("name", "type")
);

COMMENT ON TABLE "library_skills" IS 'Per-connector and capability skill docs loaded at runtime via progressive disclosure';
COMMENT ON COLUMN "library_skills"."type" IS 'connector | capability | function — categorizes the skill origin';
COMMENT ON COLUMN "library_skills"."content" IS 'Full markdown content of the SKILL.md file. Loaded on demand via load_connector tool.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. library_functions — Domain-level functions (from skills/functions/*/)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_functions" (
  "name"        text PRIMARY KEY,
  "signature"   text,
  "skill_name"  text,
  "description" text NOT NULL DEFAULT '',
  "domain"      text,
  "also_in"     jsonb DEFAULT '[]'::jsonb,
  "dependencies" jsonb DEFAULT '[]'::jsonb,
  "file_path"   text,
  "version"     text NOT NULL DEFAULT '1.0.0',
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_functions" IS 'Domain functions — composable business logic units with typed signatures';
COMMENT ON COLUMN "library_functions"."signature" IS 'TypeScript-like signature string, e.g. "(vaultId: string) => Promise<Transaction[]>"';
COMMENT ON COLUMN "library_functions"."dependencies" IS 'JSON array of connector/function names this function depends on.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. library_playbooks — Domain SOPs (from playbooks/*/playbook-*.md)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_playbooks" (
  "name"              text PRIMARY KEY,
  "type"              text NOT NULL DEFAULT 'domain',
  "scope_connectors"  jsonb DEFAULT '[]'::jsonb,
  "triggers"          jsonb DEFAULT '[]'::jsonb,
  "workflows"         jsonb DEFAULT '[]'::jsonb,
  "description"       text NOT NULL DEFAULT '',
  "file_path"         text,
  "content"           text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_playbooks" IS 'Domain-level SOP playbooks — routes intent to connector workflows';
COMMENT ON COLUMN "library_playbooks"."scope_connectors" IS 'JSON array of connector names this playbook orchestrates.';
COMMENT ON COLUMN "library_playbooks"."triggers" IS 'JSON array of trigger keywords that match this playbook to user intents.';
COMMENT ON COLUMN "library_playbooks"."workflows" IS 'JSON array of workflow names that implement playbook routines.';
COMMENT ON COLUMN "library_playbooks"."content" IS 'Full markdown content of the playbook. Loaded on demand via load_playbook tool.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. library_workflows — Durable cross-system workflows (*.workflow.ts)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_workflows" (
  "name"          text PRIMARY KEY,
  "playbook_name" text REFERENCES "library_playbooks"("name") ON DELETE SET NULL,
  "durable"       boolean NOT NULL DEFAULT false,
  "description"   text NOT NULL DEFAULT '',
  "file_path"     text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE "library_workflows" IS 'Durable Workflow DevKit workflows — parameterized playbook executions with crash recovery';
COMMENT ON COLUMN "library_workflows"."durable" IS 'True if the workflow uses Workflow DevKit durability (step.run + hooks.waitFor).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. library_edges — Relationships between graph nodes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "library_edges" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_node"   text NOT NULL,
  "from_type"   text NOT NULL,
  "to_node"     text NOT NULL,
  "to_type"     text NOT NULL,
  "edge_type"   text NOT NULL,
  "weight"      integer NOT NULL DEFAULT 1,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE ("from_node", "from_type", "to_node", "to_type", "edge_type")
);

COMMENT ON TABLE "library_edges" IS 'Directed edges between library graph nodes — computed from file content during backfill';
COMMENT ON COLUMN "library_edges"."edge_type" IS 'Relationship type: uses | routes_to | exposes | implements | called_by | depends_on | also_in';
COMMENT ON COLUMN "library_edges"."weight" IS 'Edge weight (1-10). Higher = stronger relationship. Computed from dependency depth + also_in count.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Indexes for graph traversal and edge queries
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_library_edges_from ON "library_edges"("from_node", "from_type");
CREATE INDEX IF NOT EXISTS idx_library_edges_to ON "library_edges"("to_node", "to_type");
CREATE INDEX IF NOT EXISTS idx_library_edges_type ON "library_edges"("edge_type");

-- Index for reverse reference queries (Phase 12.B + 12.F)
CREATE INDEX IF NOT EXISTS idx_library_edges_reverse ON "library_edges"("to_node", "to_type", "edge_type");
CREATE INDEX IF NOT EXISTS idx_library_edges_forward ON "library_edges"("from_node", "from_type", "edge_type");

COMMENT ON INDEX idx_library_edges_reverse IS 'Supports reverse reference queries: find all nodes that depend on X (Phase 12.B /api/library/reverse-refs)';
COMMENT ON INDEX idx_library_edges_forward IS 'Supports forward graph queries: find all nodes X depends on (Phase 12.B /api/library/graph)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. Playbook index index — for fast domain→playbook lookups
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_library_playbooks_type ON "library_playbooks"("type");

COMMENT ON INDEX idx_library_playbooks_type IS 'Supports fast domain playbook lookups for the progressive disclosure load_playbook tool.';
