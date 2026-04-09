import { EMBEDDING_DIMENSION } from '@/lib/constants/vectorSearch';

const OPENAI_BASE = 'https://api.openai.com/v1';

const VISION_USER_PROMPT =
  'Describe this product photo in one dense paragraph for visual search: product type, colors, materials, shape, patterns, distinctive features. No preamble or labels.';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
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
 * Builds a 512-dim vector for Atlas search: vision caption (OpenAI) → text embedding (OpenAI).
 * Requires OPENAI_API_KEY. Optional: OPENAI_VISION_MODEL (default gpt-4o-mini), OPENAI_EMBEDDING_MODEL (default text-embedding-3-small).
 */
export async function getImageEmbeddingFromJpegBuffer(
  jpegBuffer: Buffer
): Promise<number[]> {
  const apiKey = getApiKey();
  const visionModel =
    process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || 'text-embedding-3-small';

  const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;

  const chatRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_USER_PROMPT },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'low' },
            },
          ],
        },
      ],
      max_tokens: 400,
    }),
  });

  const chatJson: unknown = await chatRes.json().catch(() => null);
  if (!chatRes.ok) {
    throw new Error(
      `OpenAI vision error (${chatRes.status}): ${openAiErrorMessage(chatRes.status, chatJson)}`
    );
  }

  const choices = (chatJson as { choices?: unknown })?.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const content = (first as { message?: { content?: unknown } })?.message
    ?.content;
  const description =
    typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content
            .map((p) =>
              p && typeof p === 'object' && 'text' in p
                ? String((p as { text: string }).text)
                : ''
            )
            .join('')
            .trim()
        : '';

  if (!description) {
    throw new Error('OpenAI vision returned no description for the image');
  }

  const embRes = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: embeddingModel,
      input: description,
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
