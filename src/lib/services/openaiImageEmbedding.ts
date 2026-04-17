import { EMBEDDING_DIMENSION } from '@/lib/constants/vectorSearch';
import { extractVisionInfoFromJpegBuffer } from '@/lib/services/visionAttributes';

const OPENAI_BASE = 'https://api.openai.com/v1';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

function openAiErrorMessage(status: number, json: unknown): string {
  if (json && typeof json === 'object' && 'error' in json) {
    const err = (json as { error: unknown }).error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
  }
  return `HTTP ${status}`;
}

function validateEmbedding(embedding: unknown, idx: number): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`OpenAI embeddings response missing vector #${idx}`);
  }
  if (!embedding.every((x) => typeof x === 'number')) {
    throw new Error(`OpenAI embedding vector #${idx} contained non-numeric values`);
  }
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSION} (vector #${idx}), got ${embedding.length}`
    );
  }
  return embedding as number[];
}

/**
 * Batched embeddings call. Uses a single OpenAI `/embeddings` request with an
 * array input so we spend one network round-trip for up to N descriptions —
 * this is the main latency optimisation for multi-rotation fingerprinting.
 */
export async function embedDescriptionsBatch(
  descriptions: string[]
): Promise<number[][]> {
  const inputs = descriptions.map((d) => (typeof d === 'string' ? d.trim() : ''));
  if (inputs.some((d) => !d)) {
    throw new Error('embedDescriptionsBatch: all descriptions must be non-empty');
  }
  if (!inputs.length) return [];

  const apiKey = getApiKey();
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';

  const embRes = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: inputs,
      dimensions: EMBEDDING_DIMENSION,
    }),
  });

  const embJson: unknown = await embRes.json().catch(() => null);
  if (!embRes.ok) {
    throw new Error(
      `OpenAI embeddings error (${embRes.status}): ${openAiErrorMessage(embRes.status, embJson)}`
    );
  }

  const data = (embJson as { data?: unknown })?.data;
  if (!Array.isArray(data) || data.length !== inputs.length) {
    throw new Error(
      `OpenAI embeddings returned ${Array.isArray(data) ? data.length : 'no'} vectors; expected ${inputs.length}`
    );
  }

  // OpenAI guarantees response order matches input order but we sort defensively.
  const sorted = [...data].sort((a, b) => {
    const ai = typeof (a as { index?: unknown }).index === 'number'
      ? (a as { index: number }).index
      : 0;
    const bi = typeof (b as { index?: unknown }).index === 'number'
      ? (b as { index: number }).index
      : 0;
    return ai - bi;
  });

  return sorted.map((row, i) =>
    validateEmbedding((row as { embedding?: unknown }).embedding, i)
  );
}

/**
 * Embed a single description. Thin wrapper over the batched call so every
 * embedding path shares the same validation logic.
 */
export async function embedDescription(description: string): Promise<number[]> {
  const [vec] = await embedDescriptionsBatch([description]);
  if (!vec) throw new Error('embedDescription: no vector returned');
  return vec;
}

/**
 * Build a 512-dim vector for Atlas search: strict vision extraction → text
 * embedding. Kept for backward compatibility with callers that only need the
 * vector; new code should prefer {@link buildImageFingerprint} so it can
 * reuse the attributes without another vision round-trip.
 */
export async function getImageEmbeddingFromJpegBuffer(
  jpegBuffer: Buffer
): Promise<number[]> {
  const { description } = await extractVisionInfoFromJpegBuffer(jpegBuffer);
  return embedDescription(description);
}

/**
 * Single pass that returns description, attributes and embedding.
 * Used by the upload and similar-check paths to keep vision calls to one.
 */
export async function buildImageFingerprint(jpegBuffer: Buffer): Promise<{
  description: string;
  attributes: import('@/lib/constants/duplicateDetection').ProductAttributes;
  embedding: number[];
}> {
  const vision = await extractVisionInfoFromJpegBuffer(jpegBuffer);
  const embedding = await embedDescription(vision.description);
  return {
    description: vision.description,
    attributes: vision.attributes,
    embedding,
  };
}
