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

/**
 * Embed a free-form description into a 512-dim vector suitable for Atlas
 * Vector Search. Factored out so the vision + embedding calls can run
 * serially using the *same* description (no duplicate vision calls).
 */
export async function embedDescription(description: string): Promise<number[]> {
  const apiKey = getApiKey();
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';

  const input = description.trim();
  if (!input) {
    throw new Error('embedDescription called with empty input');
  }

  const embRes = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input,
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
  const row = Array.isArray(data) ? data[0] : undefined;
  const embedding = (row as { embedding?: unknown })?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('OpenAI embeddings response did not contain a vector');
  }
  if (!embedding.every((x) => typeof x === 'number')) {
    throw new Error('OpenAI embedding vector contained non-numeric values');
  }
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSION}, got ${embedding.length}`
    );
  }

  return embedding as number[];
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
