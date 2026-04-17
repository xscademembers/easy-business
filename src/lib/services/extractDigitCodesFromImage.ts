const OPENAI_BASE = 'https://api.openai.com/v1';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return key;
}

/**
 * Uses vision to list contiguous 5–7 digit sequences visible in the image (labels, tags).
 * Returns unique strings. Empty if none or on failure (caller may treat as no codes).
 */
export async function extractDigitCodesFromJpegBuffer(
  jpegBuffer: Buffer
): Promise<string[]> {
  try {
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
          {
            role: 'system',
            content:
              'You extract product or shelf codes from photos. Reply with JSON only.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'List every distinct contiguous sequence of digits that is 5 to 7 characters long visible on labels, tags, or printed on the product in this image. Respond with JSON only: {"codes":["12345"]}. Use an empty array if none.',
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'low' },
              },
            ],
          },
        ],
        max_tokens: 120,
        response_format: { type: 'json_object' },
      }),
    });

    const chatJson: unknown = await chatRes.json().catch(() => null);
    if (!chatRes.ok) {
      return [];
    }

    const choices = (chatJson as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const content = (first as { message?: { content?: unknown } })?.message
      ?.content;
    const raw =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((p) =>
                p && typeof p === 'object' && 'text' in p
                  ? String((p as { text: string }).text)
                  : ''
              )
              .join('')
          : '';
    if (!raw.trim()) return [];

    let parsed: { codes?: unknown };
    try {
      parsed = JSON.parse(raw) as { codes?: unknown };
    } catch {
      return [];
    }
    const arr = parsed.codes;
    if (!Array.isArray(arr)) return [];

    const out = new Set<string>();
    for (const item of arr) {
      if (typeof item !== 'string') continue;
      const digits = item.replace(/\D/g, '');
      if (digits.length >= 5 && digits.length <= 7) out.add(digits);
    }
    return [...out];
  } catch {
    return [];
  }
}

/**
 * Variant tuned for the `scan-by-code` flow: explicitly includes handwritten
 * numerals, widens the accepted length to 4–8 digits (a common human writing
 * range), and asks the model to ignore prices / dates / phone numbers.
 *
 * Returns distinct numeric strings only; empty array on any failure so the
 * caller can gracefully fall back to visual search.
 */
export async function extractProductCodesForScan(
  jpegBuffer: Buffer
): Promise<string[]> {
  try {
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
          {
            role: 'system',
            content:
              'You extract product codes written or printed on tags, labels, stickers or paper next to a product. You handle HANDWRITTEN digits as well as printed ones. Reply with JSON only.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Extract every numeric product code visible in this image (printed or handwritten). ' +
                  'A product code is a contiguous run of 4 to 8 digits. ' +
                  'Ignore prices with currency symbols, dates (dd/mm/yyyy), phone numbers, and any text that is clearly not a code. ' +
                  'If a digit is unclear, give your best single guess — do not output multiple variants. ' +
                  'Respond with JSON ONLY: {"codes":["12345","678901"]}. Use an empty array if none are visible.',
              },
              {
                type: 'image_url',
                image_url: { url: dataUrl, detail: 'low' },
              },
            ],
          },
        ],
        max_tokens: 160,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!chatRes.ok) return [];
    const chatJson: unknown = await chatRes.json().catch(() => null);

    const choices = (chatJson as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const content = (first as { message?: { content?: unknown } })?.message
      ?.content;
    const raw =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((p) =>
                p && typeof p === 'object' && 'text' in p
                  ? String((p as { text: string }).text)
                  : ''
              )
              .join('')
          : '';
    if (!raw.trim()) return [];

    let parsed: { codes?: unknown };
    try {
      parsed = JSON.parse(raw) as { codes?: unknown };
    } catch {
      return [];
    }
    const arr = parsed.codes;
    if (!Array.isArray(arr)) return [];

    const out = new Set<string>();
    for (const item of arr) {
      if (typeof item !== 'string') continue;
      const digits = item.replace(/\D/g, '');
      if (digits.length >= 4 && digits.length <= 8) out.add(digits);
    }
    return [...out];
  } catch {
    return [];
  }
}
