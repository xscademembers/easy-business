import { EMBEDDING_DIMENSION } from '@/lib/constants/vectorSearch';

function getClipUrl(): string {
  const url = process.env.CLIP_API_URL?.trim();
  if (!url) {
    throw new Error('CLIP_API_URL is not configured');
  }
  return url;
}

function asFloatVector(c: unknown): number[] | null {
  if (!Array.isArray(c) || c.length === 0) return null;
  if (c.every((x) => typeof x === 'number')) return c as number[];
  const inner = c[0];
  if (Array.isArray(inner) && inner.every((x) => typeof x === 'number')) {
    return inner as number[];
  }
  return null;
}

function extractEmbedding(payload: unknown): number[] | null {
  const direct = asFloatVector(payload);
  if (direct) return direct;
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;

  const candidates = [
    o.embedding,
    o.vector,
    o.embeddings,
    (o.data as Record<string, unknown> | undefined)?.embedding,
    (o.data as Record<string, unknown> | undefined)?.vector,
    Array.isArray(o.data) ? o.data[0] : null,
    Array.isArray(o.data) ? o.data : null,
  ];

  for (const c of candidates) {
    const v = asFloatVector(c);
    if (v) return v;
  }

  return null;
}

/**
 * Calls your CLIP embedding HTTP API (server-side only; keeps API keys off the client).
 *
 * Configure:
 * - CLIP_API_URL — POST endpoint that accepts JSON and returns a 512-float embedding
 * - CLIP_API_KEY — optional; sent as Authorization: Bearer …
 *
 * Default request body: `{ "image": "<base64 without data URL prefix>" }`
 * Override field name: CLIP_IMAGE_JSON_FIELD (default: image)
 */
export async function getClipEmbeddingFromJpegBuffer(
  jpegBuffer: Buffer
): Promise<number[]> {
  const url = getClipUrl();
  const key = process.env.CLIP_API_KEY?.trim();
  const field =
    process.env.CLIP_IMAGE_JSON_FIELD?.trim() || 'image';
  const base64 = jpegBuffer.toString('base64');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ [field]: base64 }),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error('CLIP API returned a non-JSON response');
  }

  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'error' in json
        ? String((json as { error: unknown }).error)
        : res.statusText;
    throw new Error(`CLIP API error (${res.status}): ${msg}`);
  }

  const embedding = extractEmbedding(json);
  if (!embedding) {
    throw new Error('CLIP API response did not contain a numeric embedding array');
  }

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected embedding length ${EMBEDDING_DIMENSION}, got ${embedding.length}`
    );
  }

  return embedding;
}
