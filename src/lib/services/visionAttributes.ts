import {
  coerceAttributes,
  emptyAttributes,
  type ProductAttributes,
} from '@/lib/constants/duplicateDetection';

const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT =
  'You are a strict product analyst. Color differences ALWAYS mean different products. ' +
  'Small design differences matter. You always commit to a single dominant colour, even under uneven lighting. Reply with JSON only.';

/**
 * Fixed palette forces the model to commit to one of ~16 canonical colours so
 * two products of the same type but different colour produce DIRECTLY
 * comparable `primary_color` strings. Free-form colour names (e.g. "navy" vs
 * "dark blue") previously caused the duplicate check to mis-fire.
 */
const COLOR_PALETTE =
  'red, orange, yellow, green, blue, purple, pink, brown, black, white, gray, beige, gold, silver, multicolor';

const USER_INSTRUCTION =
  'Analyze this product photo. Return ONLY JSON with this exact shape: ' +
  '{"description":"","attributes":{"product_type":"","brand":"","primary_color":"","secondary_color":"","pattern":"","shape":"","logo_text":"","unique_features":""}}.\n' +
  'HARD RULES:\n' +
  '- product_type: REQUIRED. One short lowercase noun (e.g. "wristwatch", "sneaker", "t-shirt", "handbag", "bottle"). Never "".\n' +
  `- primary_color: REQUIRED. Pick the single DOMINANT colour from this exact list: ${COLOR_PALETTE}. Never "". Ignore background, packaging, and shadows — only consider the product itself. If the product shows two colours of similar area, pick the one covering the largest region; use "multicolor" only when 3+ colours are prominent.\n` +
  '- secondary_color: same palette or "" if none clearly secondary.\n' +
  '- pattern: one of solid, striped, checkered, floral, graphic, logo, dots, abstract, or "".\n' +
  '- brand / logo_text: "" if not clearly legible. Never guess.\n' +
  '- All attribute values lowercase.\n' +
  'description: one dense paragraph for visual search, written in this order — primary_color, product_type, secondary_color, materials, shape, pattern, distinctive features. Begin with the colour so the embedding reflects it strongly. No preamble or labels.';

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
