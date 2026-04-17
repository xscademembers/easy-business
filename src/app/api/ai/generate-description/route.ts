import { NextResponse } from 'next/server';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';

const OPENAI_BASE = 'https://api.openai.com/v1';

const SYSTEM_PROMPT =
  'You write short ecommerce product descriptions. Be factual and concise. Output 2–3 lines total. No title line, no quotes, no markdown headings, no emojis.';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

function getModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';
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

async function fetchImageAsDataUrl(rawUrl: string): Promise<string | null> {
  try {
    const res = await fetch(rawUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { buffer } = await compressImageForClip(buf);
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * POST /api/ai/generate-description
 *
 * Body:
 *  - name: string (required)
 *  - imageBase64?: string  (client-provided data URL / raw base64)
 *  - image_url?: string    (http(s) URL we can fetch server-side)
 *
 * Behaviour:
 *  - Always generates a fresh description; no state carried between calls.
 *  - Accepts either image format; if both are missing or the URL can't be
 *    fetched, falls back cleanly to a text-only (name-driven) generation.
 *  - Output is constrained to 2–3 sentences, plain text, no title line.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { name, imageBase64, image_url } = body as {
      name?: string;
      imageBase64?: string;
      image_url?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const apiKey = getApiKey();
    const model = getModel();

    // Resolve the image source once, ignoring sources we can't use so the
    // route degrades gracefully to a name-only prompt.
    let imageDataUrl: string | null = null;

    if (typeof imageBase64 === 'string' && imageBase64.trim().length > 0) {
      try {
        const { buffer } = await compressImageForClip(imageBase64);
        imageDataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      } catch {
        imageDataUrl = null;
      }
    } else if (
      typeof image_url === 'string' &&
      /^https?:\/\//i.test(image_url.trim())
    ) {
      imageDataUrl = await fetchImageAsDataUrl(image_url.trim());
    }

    const userContent: unknown[] = [
      {
        type: 'text',
        text: imageDataUrl
          ? `Product name: "${trimmedName}". Write a customer-facing description using the name and what you see in the image. 2–3 lines, factual, no preamble.`
          : `Product name: "${trimmedName}". Write a customer-facing description based only on the name. 2–3 lines, factual, no preamble.`,
      },
    ];
    if (imageDataUrl) {
      userContent.push({
        type: 'image_url',
        image_url: { url: imageDataUrl, detail: 'low' },
      });
    }

    const chatRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 180,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    const chatJson: unknown = await chatRes.json().catch(() => null);
    if (!chatRes.ok) {
      return NextResponse.json(
        {
          error: openAiErrorMessage(chatRes.status, chatJson),
        },
        { status: 502 }
      );
    }

    const description = extractContentText(chatJson);
    if (!description) {
      return NextResponse.json(
        { error: 'Model returned no description' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      description,
      usedImage: Boolean(imageDataUrl),
      model,
    });
  } catch (error) {
    console.error('POST /api/ai/generate-description error:', error);
    const message =
      error instanceof Error ? error.message : 'Generate description failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
