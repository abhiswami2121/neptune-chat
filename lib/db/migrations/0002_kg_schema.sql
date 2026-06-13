-- U7.1: Knowledge Graph Schema (Postgres + pgvector + ltree)
-- Enables the 3-layer brain: Playbooks (HOW) + KG (WHAT) + Raw Logs (WHEN)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- ── KG Entities ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kg_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "properties" jsonb DEFAULT '{}' NOT NULL,
  "embedding" vector(768),
  "path" ltree,
  "confidence" double precision DEFAULT 1.0 NOT NULL,
  "provenance" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "uq_entities_type_name" UNIQUE ("type", "name")
);

-- ── KG Relations (graph edges) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kg_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "from_entity_id" uuid NOT NULL REFERENCES "kg_entities"("id") ON DELETE CASCADE,
  "to_entity_id" uuid NOT NULL REFERENCES "kg_entities"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "properties" jsonb DEFAULT '{}' NOT NULL,
  "confidence" double precision DEFAULT 1.0 NOT NULL,
  "provenance" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "uq_relations_from_to_type" UNIQUE ("from_entity_id", "to_entity_id", "type")
);

-- ── KG Provenance (audit log) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kg_provenance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_id" uuid REFERENCES "kg_entities"("id") ON DELETE SET NULL,
  "relation_id" uuid REFERENCES "kg_relations"("id") ON DELETE SET NULL,
  "source_session_id" text NOT NULL,
  "source_turn_id" text,
  "source_log_path" text,
  "confidence" double precision,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- ── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "idx_kg_entities_type" ON "kg_entities"("type");
CREATE INDEX IF NOT EXISTS "idx_kg_entities_name" ON "kg_entities"("name");
CREATE INDEX IF NOT EXISTS "idx_kg_entities_path" ON "kg_entities" USING GIST ("path");
CREATE INDEX IF NOT EXISTS "idx_kg_entities_embedding" ON "kg_entities" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS "idx_kg_relations_from" ON "kg_relations"("from_entity_id");
CREATE INDEX IF NOT EXISTS "idx_kg_relations_to" ON "kg_relations"("to_entity_id");
CREATE INDEX IF NOT EXISTS "idx_kg_relations_type" ON "kg_relations"("type");
CREATE INDEX IF NOT EXISTS "idx_kg_provenance_session" ON "kg_provenance"("source_session_id");
