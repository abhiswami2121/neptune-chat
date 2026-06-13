/**
 * U7.3: Knowledge Extraction Pipeline
 *
 * LLM-driven extraction from raw logs → structured knowledge (facts, relations, lessons).
 * Uses DeepSeek for structured extraction, upserts into PG KG.
 *
 * Triggers:
 * - Nightly cron: 03:00 UTC (vercel.json)
 * - Session-end hook: immediate extraction for live healing
 * - On-demand: /api/knowledge/extract?sessionId=X
 */

import { upsertEntity, upsertRelation } from "./client";
import { generateEmbedding } from "./embeddings";
import type { EntityInsert, KnowledgeExtraction, RelationInsert } from "./types";
import type { RawLogEntry } from "../raw-logs/types";

// ── DeepSeek Extraction Client ─────────────────────────────────────────────

interface DeepSeekExtractionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callDeepSeekExtraction(
  log: RawLogEntry
): Promise<KnowledgeExtraction | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[extractor] DEEPSEEK_API_KEY not set — skipping extraction");
    return null;
  }

  const prompt = buildExtractionPrompt(log);

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a knowledge extraction system. Extract structured facts, relations, lessons, cardinals, and connector quirks from agent conversation logs. Output ONLY valid JSON matching the specified schema. Do not include markdown formatting or extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      console.warn(`[extractor] DeepSeek returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as DeepSeekExtractionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const extraction = JSON.parse(content) as KnowledgeExtraction;
    return extraction;
  } catch (err) {
    console.warn("[extractor] DeepSeek call failed:", (err as Error).message);
    return null;
  }
}

function buildExtractionPrompt(log: RawLogEntry): string {
  return `Extract structured knowledge from this agent conversation log. Focus on:
- FACTS: entities mentioned (connectors, skills, workflows, domains, patterns, cardinals, concepts)
- RELATIONS: how entities relate (USES, REQUIRES, BLOCKS, REFERENCES, LEARNED_FROM, DEPENDS_ON, etc.)
- LESSONS: patterns learned, recommendations (with confidence 0-1)
- CARDINALS: non-negotiable rules discovered
- CONNECTOR_QUIRKS: connector-specific behaviors and workarounds

Log entry:
Session: ${log.sessionId}
Turn: ${log.id}
Timestamp: ${log.timestamp}
User: ${log.userMessage?.slice(0, 500)}
Playbook: ${log.loadedPlaybook ?? "none"}
Routine: ${log.loadedRoutine ?? "none"}
Tool calls: ${JSON.stringify(log.toolCalls?.slice(0, 5))}
Reasoning: ${log.reasoning?.slice(0, 1000)}
Response: ${log.finalResponse?.slice(0, 1000)}
Outcome: ${JSON.stringify(log.outcomes)}

Return ONLY a JSON object with this EXACT structure:
{
  "facts": [{"entity": {"type": "EntityType", "name": "string", "description": "string", "properties": {}}}],
  "relations": [{"from": {"type": "EntityType", "name": "string"}, "to": {"type": "EntityType", "name": "string"}, "type": "RelationType", "properties": {}}],
  "lessons": [{"pattern": "string", "recommendation": "string", "confidence": 0.0}],
  "cardinals": [{"rule": "string", "source": "string"}],
  "connector_quirks": [{"connector": "string", "behavior": "string", "recommendation": "string"}]
}

EntityType must be one of: Connector, Skill, Workflow, Domain, Pattern, Cardinal, Concept, Session, Lesson
RelationType must be one of: USES, REQUIRES, BLOCKS, REFERENCES, LEARNED_FROM, DEPENDS_ON, CONFLICTS_WITH, SUPERSEDES`;
}

// ── Extraction Pipeline ────────────────────────────────────────────────────

export async function extractKnowledgeFromLog(
  log: RawLogEntry
): Promise<{
  entitiesUpserted: number;
  relationsUpserted: number;
  lessonsFound: number;
  cardinalsFound: number;
}> {
  let entitiesUpserted = 0;
  let relationsUpserted = 0;
  let lessonsFound = 0;
  let cardinalsFound = 0;

  // Try LLM extraction
  const extraction = await callDeepSeekExtraction(log);

  if (!extraction) {
    // Heuristic fallback: extract basic facts from tool calls and outcomes
    return heuristicExtraction(log);
  }

  const provenance = {
    sessionId: log.sessionId,
    turnId: log.id,
    timestamp: log.timestamp,
  };

  // Upsert facts as entities
  for (const fact of extraction.facts ?? []) {
    try {
      const embedding = await generateEmbedding(
        fact.entity.description ?? fact.entity.name
      );
      const entityInsert: EntityInsert = {
        ...fact.entity,
        embedding,
        provenance,
        confidence: fact.entity.properties?.confidence
          ? (fact.entity.properties.confidence as number)
          : 0.9,
      };
      await upsertEntity(entityInsert);
      entitiesUpserted++;
    } catch (err) {
      console.warn("[extractor] Entity upsert failed:", (err as Error).message);
    }
  }

  // Upsert relations
  for (const rel of extraction.relations ?? []) {
    try {
      // Resolve entity IDs from type+name
      const { getEntityByTypeAndName } = await import("./client");
      const fromEntity = await getEntityByTypeAndName(
        rel.from.type,
        rel.from.name
      );
      const toEntity = await getEntityByTypeAndName(rel.to.type, rel.to.name);

      if (fromEntity && toEntity) {
        await upsertRelation({
          from_entity_id: fromEntity.id,
          to_entity_id: toEntity.id,
          type: rel.type,
          properties: rel.properties,
          provenance,
        });
        relationsUpserted++;
      }
    } catch (err) {
      console.warn("[extractor] Relation upsert failed:", (err as Error).message);
    }
  }

  // Upsert lessons
  for (const lesson of extraction.lessons ?? []) {
    try {
      if (lesson.confidence > 0.6) {
        await upsertEntity({
          type: "Lesson",
          name: lesson.pattern.slice(0, 200),
          description: lesson.recommendation,
          properties: { confidence: lesson.confidence },
          confidence: lesson.confidence,
          provenance,
        });
        lessonsFound++;
      }
    } catch (err) {
      console.warn("[extractor] Lesson upsert failed:", (err as Error).message);
    }
  }

  // Upsert cardinals
  for (const cardinal of extraction.cardinals ?? []) {
    try {
      await upsertEntity({
        type: "Cardinal",
        name: cardinal.rule.slice(0, 200),
        description: `Source: ${cardinal.source}`,
        properties: { source: cardinal.source },
        confidence: 1.0,
        provenance,
      });
      cardinalsFound++;
    } catch (err) {
      console.warn("[extractor] Cardinal upsert failed:", (err as Error).message);
    }
  }

  return { entitiesUpserted, relationsUpserted, lessonsFound, cardinalsFound };
}

// ── Heuristic Fallback ─────────────────────────────────────────────────────

async function heuristicExtraction(log: RawLogEntry): Promise<{
  entitiesUpserted: number;
  relationsUpserted: number;
  lessonsFound: number;
  cardinalsFound: number;
}> {
  let entitiesUpserted = 0;
  const provenance = {
    sessionId: log.sessionId,
    turnId: log.id,
    timestamp: log.timestamp,
  };

  // Create a Session entity for this log entry
  try {
    await upsertEntity({
      type: "Session",
      name: `session-${log.sessionId.slice(0, 8)}`,
      description: `Chat session from ${log.timestamp}`,
      properties: {
        turnCount: 1,
        playbook: log.loadedPlaybook,
        success: log.outcomes.success,
        durationMs: log.outcomes.durationMs,
      },
      provenance,
    });
    entitiesUpserted++;
  } catch {
    // Session entity may already exist
  }

  // Extract tool names as Connector/Pattern entities
  for (const tc of log.toolCalls ?? []) {
    try {
      await upsertEntity({
        type: "Pattern",
        name: `tool-usage-${tc.tool}`,
        description: `Agent used tool: ${tc.tool} (${tc.durationMs}ms)`,
        properties: { tool: tc.tool, durationMs: tc.durationMs },
        provenance,
      });
      entitiesUpserted++;
    } catch {
      // Tool entity may already exist
    }
  }

  return {
    entitiesUpserted,
    relationsUpserted: 0,
    lessonsFound: 0,
    cardinalsFound: 0,
  };
}

// ── Batch Extraction (for cron) ────────────────────────────────────────────

export async function extractFromRecentLogs(
  hoursBack = 24,
  limit = 50
): Promise<{
  processed: number;
  totalEntitiesUpserted: number;
  totalRelationsUpserted: number;
}> {
  const { queryRawLogs } = await import("../raw-logs/collector");

  const startDate = new Date(
    Date.now() - hoursBack * 60 * 60 * 1000
  ).toISOString();

  const result = await queryRawLogs({
    startDate,
    limit,
  });

  let totalEntitiesUpserted = 0;
  let totalRelationsUpserted = 0;

  for (const log of result.entries) {
    const stats = await extractKnowledgeFromLog(log);
    totalEntitiesUpserted += stats.entitiesUpserted;
    totalRelationsUpserted += stats.relationsUpserted;
  }

  return {
    processed: result.entries.length,
    totalEntitiesUpserted,
    totalRelationsUpserted,
  };
}
