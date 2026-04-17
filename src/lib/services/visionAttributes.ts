import {
  coerceAttributes,
  emptyAttributes,
  type ProductAttributes,
} from '@/lib/constants/duplicateDetection';

const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT =
  'You are a strict product analyst. Detect exact visible details. Color differences must be treated as different products. Small design differences matter. Be strict. Reply with JSON only.';

const USER_INSTRUCTION =
  'Analyze this product photo. Return ONLY JSON with this exact shape: ' +
  '{"description":"","attributes":{"product_type":"","brand":"","primary_color":"","secondary_color":"","pattern":"","shape":"","logo_text":"","unique_features":""}}. ' +
  'description = one dense paragraph for visual search (type, colors, materials, shape, patterns, distinctive features), no preamble or labels. ' +
  'Every attribute value is lowercase; use "" if not clearly visible. Never guess brand or logo text.';

export interface VisionExtraction {
  description: string;
  attributes: ProductAttributes;
}

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

function extractContentText(chatJson: unknown): string {
  const choices = (chatJson as { choices?: unknown })?.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const content = (first as { message?: { content?: unknown } })?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        p && typeof p === 'object' && 'text' in p
          ? String((p as { text: string }).text)
          : ''
      )
      .join('')
      .trim();
  }
  return '';
}

/**
 * Single strict-JSON vision call that returns both the dense description
 * (used to derive the OpenAI text embedding) and the identity attributes
 * used to gate duplicate detection.
 *
 * Keeping this in one round-trip — instead of a separate caption + attribute
 * pair of calls — is the main latency optimisation for the upload path.
 */
export async function extractVisionInfoFromJpegBuffer(
  jpegBuffer: Buffer
): Promise<VisionExtraction> {
  const apiKey = getApiKey();
  const visionModel =
    process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';
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
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_INSTRUCTION },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'low' },
            },
          ],
        },
      ],
      max_tokens: 400,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  const chatJson: unknown = await chatRes.json().catch(() => null);
  if (!chatRes.ok) {
    throw new Error(
      `OpenAI vision error (${chatRes.status}): ${openAiErrorMessage(chatRes.status, chatJson)}`
    );
  }

  const raw = extractContentText(chatJson);
  if (!raw) {
    throw new Error('OpenAI vision returned no content');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error('OpenAI vision returned non-JSON content');
  }

  const description =
    typeof parsed.description === 'string' ? parsed.description.trim() : '';
  if (!description) {
    // We need a non-empty description to embed; fall back to a trimmed raw.
    return {
      description: raw.slice(0, 1000),
      attributes: coerceAttributes(parsed.attributes),
    };
  }

  const attributes = coerceAttributes(parsed.attributes ?? emptyAttributes());
  return { description, attributes };
}
