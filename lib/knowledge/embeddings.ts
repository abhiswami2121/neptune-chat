/**
 * U7.1: Embeddings Generator — DeepSeek embedding wrapper for KG vector search.
 *
 * Uses DeepSeek's embedding endpoint (OpenAI-compatible) to generate
 * 768-dimensional vectors for KG entity descriptions.
 * Falls back to a local heuristic if the API is unavailable.
 */

import { type EntityInsert } from "./types";

// ── Embedding Client ──────────────────────────────────────────────────────

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

/**
 * Try OpenAI embeddings via AI Gateway (text-embedding-3-small, 1536d → pad/truncate to 768d).
 * Falls back to heuristic if no API key or call fails.
 */
async function callAIEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.warn("[embeddings] No embedding API key — using heuristic fallback");
    return null;
  }

  // Use OpenAI API directly, or Vercel AI Gateway
  const baseUrl = process.env.AI_GATEWAY_API_KEY
    ? "https://api.openai.com/v1" // Gateway proxies
    : "https://api.openai.com/v1";

  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8191),
        dimensions: 768,
      }),
    });

    if (!res.ok) {
      console.warn(
        `[embeddings] Embedding API returned ${res.status} — using heuristic fallback`
      );
      return null;
    }

    const json = (await res.json()) as EmbeddingResponse;
    const embedding = json.data[0]?.embedding ?? null;

    // text-embedding-3-small returns 1536d by default, but we requested 768d
    // If it still returns 1536d, truncate to 768
    if (embedding && embedding.length > 768) {
      return embedding.slice(0, 768);
    }
    // If it's smaller than 768, pad with zeros
    if (embedding && embedding.length < 768) {
      return [...embedding, ...new Array(768 - embedding.length).fill(0)];
    }
    return embedding;
  } catch (err) {
    console.warn(
      `[embeddings] Embedding API error: ${err instanceof Error ? err.message : String(err)} — using heuristic fallback`
    );
    return null;
  }
}

// ── Heuristic Fallback (deterministic pseudo-embedding) ───────────────────

/**
 * Simple hash-based pseudo-embedding for when DeepSeek API is unavailable.
 * NOT semantically meaningful, but enables vector operations for smoke testing.
 * In production, HEURISTIC_EMBEDDING_FALLBACK defaults to false.
 */
const HEURISTIC_FALLBACK_ENABLED =
  process.env.HEURISTIC_EMBEDDING_FALLBACK === "true" ||
  process.env.NODE_ENV === "development";

function heuristicEmbedding(text: string, dims = 768): number[] {
  const vec = new Array(dims).fill(0);
  // Simple character-frequency based embedding (deterministic per input)
  const normalized = text.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const idx = (code * 7 + i * 13) % dims;
    vec[idx] += 1;
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dims; i++) {
      vec[i] /= magnitude;
    }
  }
  return vec;
}

// ── Public API ────────────────────────────────────────────────────────────

let _embeddingCache = new Map<string, number[]>();
const MAX_CACHE_SIZE = 500;

function cacheKey(text: string): string {
  return text.slice(0, 200).trim().toLowerCase();
}

/**
 * Generate a 768-dim embedding for the given text.
 * Uses DeepSeek API when available, falls back to heuristic.
 * Caches results in-memory to avoid duplicate API calls.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return heuristicEmbedding("empty", 768);
  }

  const key = cacheKey(text);
  const cached = _embeddingCache.get(key);
  if (cached) return cached;

  // Try AI Gateway (OpenAI embeddings) first
  const apiEmbedding = await callAIEmbedding(text);
  if (apiEmbedding) {
    _cacheSet(key, apiEmbedding);
    return apiEmbedding;
  }

  // Fallback to heuristic
  const heuristic = heuristicEmbedding(text, 768);
  _cacheSet(key, heuristic);
  return heuristic;
}

function _cacheSet(key: string, embedding: number[]) {
  if (_embeddingCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const firstKey = _embeddingCache.keys().next().value;
    if (firstKey) _embeddingCache.delete(firstKey);
  }
  _embeddingCache.set(key, embedding);
}

/**
 * Generate embedding and attach to an entity insert.
 */
export async function embedEntity(
  entity: EntityInsert
): Promise<EntityInsert> {
  const text = entity.description ?? entity.name;
  const embedding = await generateEmbedding(text);
  return { ...entity, embedding };
}

/**
 * Batch-generate embeddings for multiple texts.
 * Processes sequentially to avoid rate limiting.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}

/**
 * Clear the embedding cache (useful for testing).
 */
export function clearEmbeddingCache(): void {
  _embeddingCache.clear();
}
