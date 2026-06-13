/**
 * U7.1: Knowledge Graph Type Definitions
 *
 * Entity types and Relation types for the Postgres-native KG.
 * Used across client, queries, extractor, and wiki components.
 */

// ── Entity Types ─────────────────────────────────────────────────────────

export const ENTITY_TYPES = [
  "Connector",
  "Skill",
  "Workflow",
  "Domain",
  "Pattern",
  "Cardinal",
  "Concept",
  "Session",
  "Lesson",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

// ── Relation Types ────────────────────────────────────────────────────────

export const RELATION_TYPES = [
  "USES",
  "REQUIRES",
  "BLOCKS",
  "REFERENCES",
  "LEARNED_FROM",
  "DEPENDS_ON",
  "CONFLICTS_WITH",
  "SUPERSEDES",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

// ── Core Interfaces ──────────────────────────────────────────────────────

export interface KgEntity {
  id: string;
  type: EntityType;
  name: string;
  description: string | null;
  properties: Record<string, unknown>;
  embedding: number[] | null;
  path: string | null;
  confidence: number;
  provenance: Provenance | null;
  created_at: string;
  updated_at: string;
}

export interface KgRelation {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  type: RelationType;
  properties: Record<string, unknown>;
  confidence: number;
  provenance: Provenance | null;
  created_at: string;
}

export interface KgProvenanceEntry {
  id: string;
  entity_id: string | null;
  relation_id: string | null;
  source_session_id: string;
  source_turn_id: string | null;
  source_log_path: string | null;
  confidence: number | null;
  created_at: string;
}

export interface Provenance {
  sessionId: string;
  turnId?: string;
  timestamp?: string;
  sourceLog?: string;
}

// ── Query Result Types ────────────────────────────────────────────────────

export interface KnowledgeResult {
  entities: KgEntity[];
  relations: KgRelation[];
  lessons: KgEntity[]; // entities of type 'Lesson'
  cardinals: KgEntity[]; // entities of type 'Cardinal'
  source_logs: SessionRef[];
  recommended_skills: string[];
}

export interface SessionRef {
  sessionId: string;
  turnCount: number;
  timestamp: string;
}

// ── Insert Types ──────────────────────────────────────────────────────────

export interface EntityInsert {
  type: EntityType;
  name: string;
  description?: string;
  properties?: Record<string, unknown>;
  embedding?: number[];
  path?: string;
  confidence?: number;
  provenance?: Provenance;
}

export interface RelationInsert {
  from_entity_id: string;
  to_entity_id: string;
  type: RelationType;
  properties?: Record<string, unknown>;
  confidence?: number;
  provenance?: Provenance;
}

// ── Extraction Types (U7.3) ──────────────────────────────────────────────

export interface KnowledgeExtraction {
  facts: Array<{
    entity: EntityInsert;
  }>;
  relations: Array<{
    from: { type: EntityType; name: string };
    to: { type: EntityType; name: string };
    type: RelationType;
    properties?: Record<string, unknown>;
  }>;
  lessons: Array<{
    pattern: string;
    recommendation: string;
    confidence: number;
  }>;
  cardinals: Array<{
    rule: string;
    source: string;
  }>;
  connector_quirks: Array<{
    connector: string;
    behavior: string;
    recommendation: string;
  }>;
}

// ── Speed Test Types ─────────────────────────────────────────────────────

export interface SpeedTestResult {
  name: string;
  targetMs: number;
  actualMs: number;
  passed: boolean;
  details?: string;
}

export interface SpeedTestSuite {
  timestamp: string;
  postgresUrl: string;
  results: SpeedTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    verdict: "PASS" | "FAIL" | "PARTIAL";
  };
}
