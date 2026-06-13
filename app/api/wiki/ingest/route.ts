/**
 * POST /api/wiki/ingest — Ingest KG entities (auto-apply or dry-run)
 *
 * Phase 5: U9 Annotation Loop — Karpathy Vision
 * Used by the u9_annotation_loop.py cron to auto-apply LOW-RISK KG updates.
 *
 * Auth: Bearer NEPTUNE_INTERNAL_TOKEN (bypasses session check)
 *       OR authenticated admin session
 *
 * Body: {
 *   entities: EntityInsert[],
 *   relations?: { from: {type, name}, to: {type, name}, type: RelationType, ... }[],
 *   source: string,
 *   confidence?: number,
 *   dry_run?: boolean
 * }
 *
 * Response: {
 *   dryRun: boolean,
 *   ingested: { entities: number, relations: number },
 *   entityIds: string[],
 *   relationIds: string[],
 *   errors: string[]
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAllowlist } from "@/lib/auth/require-allowlist";
import {
  upsertEntity,
  upsertRelation,
  getEntityByTypeAndName,
} from "@/lib/knowledge/client";
import { ENTITY_TYPES, RELATION_TYPES } from "@/lib/knowledge/types";
import type { EntityInsert, RelationInsert, EntityType, RelationType } from "@/lib/knowledge/types";

// ── Ingest Request / Response Types ────────────────────────────────────────

interface IngestEntityRequest extends Omit<EntityInsert, "type"> {
  type: string; // validated against ENTITY_TYPES
}

interface IngestRelationRequest {
  from: { type: string; name: string };
  to: { type: string; name: string };
  type: string;
  properties?: Record<string, unknown>;
  confidence?: number;
}

interface IngestRequest {
  entities: IngestEntityRequest[];
  relations?: IngestRelationRequest[];
  source: string;
  confidence?: number;
  dry_run?: boolean;
}

interface IngestResponse {
  dryRun: boolean;
  ingested: { entities: number; relations: number };
  entityIds: string[];
  relationIds: string[];
  errors: string[];
}

// ── Validation ─────────────────────────────────────────────────────────────

function validateEntityType(type: string): asserts type is EntityType {
  if (!(ENTITY_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `Invalid entity type: "${type}". Must be one of: ${ENTITY_TYPES.join(", ")}`
    );
  }
}

function validateRelationType(type: string): asserts type is RelationType {
  if (!(RELATION_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `Invalid relation type: "${type}". Must be one of: ${RELATION_TYPES.join(", ")}`
    );
  }
}

function validateEntities(entities: IngestEntityRequest[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    try {
      validateEntityType(e.type);
      if (!e.name || typeof e.name !== "string" || e.name.trim().length === 0) {
        throw new Error("Entity name is required");
      }
      if (e.confidence !== undefined && (e.confidence < 0 || e.confidence > 1)) {
        throw new Error("Confidence must be between 0 and 1");
      }
    } catch (err) {
      errors.push(`entities[${i}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}

function validateRelations(relations: IngestRelationRequest[]): string[] {
  const errors: string[] = [];
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i];
    try {
      validateRelationType(r.type);
      if (!r.from?.type || !r.from?.name) {
        throw new Error("Relation 'from' must have type and name");
      }
      if (!r.to?.type || !r.to?.name) {
        throw new Error("Relation 'to' must have type and name");
      }
      validateEntityType(r.from.type);
      validateEntityType(r.to.type);
    } catch (err) {
      errors.push(`relations[${i}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return errors;
}

// ── Handler ────────────────────────────────────────────────────────────────

export const POST = requireAllowlist(async (req: NextRequest) => {
  const errors: string[] = [];
  const entityIds: string[] = [];
  const relationIds: string[] = [];
  let entityCount = 0;
  let relationCount = 0;

  try {
    const body: IngestRequest = await req.json();
    const { entities, relations = [], source, confidence, dry_run = false } = body;

    // Source is required for provenance tracking
    if (!source || typeof source !== "string" || source.trim().length === 0) {
      return NextResponse.json(
        { error: "source is required — identifies the caller (e.g. 'u9-annotation-loop')" },
        { status: 400 }
      );
    }

    // Validate entities
    if (!Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json(
        { error: "entities array is required and must not be empty" },
        { status: 400 }
      );
    }

    const entityErrors = validateEntities(entities);
    errors.push(...entityErrors);

    if (relations.length > 0) {
      const relErrors = validateRelations(relations);
      errors.push(...relErrors);
    }

    // If validation errors exist and NOT a dry run, fail early
    if (errors.length > 0 && !dry_run) {
      return NextResponse.json(
        { error: "Validation failed", errors },
        { status: 422 }
      );
    }

    const defaultConfidence = confidence ?? 0.8;

    // ── Process entities ──────────────────────────────────────────────────
    if (dry_run) {
      // Dry-run: just count what would be ingested
      entityCount = entities.length;
      relationCount = relations.length;
      for (let i = 0; i < entities.length; i++) {
        entityIds.push(`dry-run-entity-${i}`);
      }
      for (let i = 0; i < relations.length; i++) {
        relationIds.push(`dry-run-relation-${i}`);
      }
    } else {
      // Live: actually insert
      for (const e of entities) {
        validateEntityType(e.type);
        const entity: EntityInsert = {
          type: e.type as EntityType,
          name: e.name.trim(),
          description: e.description,
          properties: {
            ...(e.properties ?? {}),
            _ingested_by: source,
            _ingested_at: new Date().toISOString(),
          },
          path: e.path ?? null,
          confidence: e.confidence ?? defaultConfidence,
          provenance: e.provenance ?? {
            sessionId: `u9-annotation-loop`,
            timestamp: new Date().toISOString(),
          },
        };

        try {
          const result = await upsertEntity(entity);
          entityIds.push(result.id);
          entityCount++;
        } catch (err) {
          errors.push(
            `Failed to upsert entity "${e.name}": ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // ── Process relations ───────────────────────────────────────────────
      // Resolve entity type+name → ID before inserting relations
      for (const r of relations) {
        try {
          // Resolve 'from' entity
          const fromEntity = await getEntityByTypeAndName(
            r.from.type as EntityType,
            r.from.name
          );
          if (!fromEntity) {
            errors.push(
              `Relation 'from' entity not found: ${r.from.type}:${r.from.name} — create it first`
            );
            continue;
          }

          // Resolve 'to' entity
          const toEntity = await getEntityByTypeAndName(
            r.to.type as EntityType,
            r.to.name
          );
          if (!toEntity) {
            errors.push(
              `Relation 'to' entity not found: ${r.to.type}:${r.to.name} — create it first`
            );
            continue;
          }

          const relation: RelationInsert = {
            from_entity_id: fromEntity.id,
            to_entity_id: toEntity.id,
            type: r.type as RelationType,
            properties: {
              ...(r.properties ?? {}),
              _ingested_by: source,
            },
            confidence: r.confidence ?? defaultConfidence,
            provenance: {
              sessionId: `u9-annotation-loop`,
              timestamp: new Date().toISOString(),
            },
          };

          const result = await upsertRelation(relation);
          relationIds.push(result.id);
          relationCount++;
        } catch (err) {
          errors.push(
            `Failed to upsert relation ${r.from.type}:${r.from.name} → ${r.to.type}:${r.to.name}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    const response: IngestResponse = {
      dryRun: dry_run,
      ingested: { entities: entityCount, relations: relationCount },
      entityIds,
      relationIds,
      errors,
    };

    return NextResponse.json(response, {
      status: dry_run ? 200 : 201,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        ingested: { entities: entityCount, relations: relationCount },
        entityIds,
        relationIds,
        errors,
      },
      { status: 500 }
    );
  }
});
