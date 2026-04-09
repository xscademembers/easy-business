import { NextResponse } from 'next/server';
import { compressImageForClip } from '@/lib/services/imageCompressionServer';

const OPENAI_BASE = 'https://api.openai.com/v1';

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return key;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, imageBase64 } = body as {
      name?: string;
      imageBase64?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const apiKey = getApiKey();
    const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';

    const trimmedName = name.trim();

    if (typeof imageBase64 === 'string' && imageBase64.length > 0) {
      const { buffer } = await compressImageForClip(imageBase64);
      const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      const chatRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You write short product descriptions for e-commerce. Be factual and concise (2–4 sentences). No title line.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Product name: "${trimmedName}". Write a customer-facing description based on the name and what you see in the image.`,
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl, detail: 'low' },
                },
              ],
            },
          ],
          max_tokens: 300,
        }),
      });

      const chatJson: unknown = await chatRes.json().catch(() => null);
      if (!chatRes.ok) {
        const msg =
          chatJson &&
          typeof chatJson === 'object' &&
          'error' in chatJson &&
          chatJson.error &&
          typeof chatJson.error === 'object' &&
          'message' in chatJson.error
            ? String((chatJson.error as { message: unknown }).message)
            : `HTTP ${chatRes.status}`;
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const choices = (chatJson as { choices?: unknown })?.choices;
      const first = Array.isArray(choices) ? choices[0] : undefined;
      const content = (first as { message?: { content?: unknown } })?.message
        ?.content;
      const text =
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

      if (!text) {
        return NextResponse.json(
          { error: 'Model returned no description' },
          { status: 502 }
        );
      }
      return NextResponse.json({ description: text });
    }

    const chatRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You write short product descriptions for e-commerce. Be factual and concise (2–4 sentences).',
          },
          {
            role: 'user',
            content: `Product name: "${trimmedName}". Write a short description based only on the name.`,
          },
        ],
        max_tokens: 250,
      }),
    });

    const chatJson: unknown = await chatRes.json().catch(() => null);
    if (!chatRes.ok) {
      return NextResponse.json(
        { error: 'Could not generate description' },
        { status: 502 }
      );
    }
    const choices = (chatJson as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const content = (first as { message?: { content?: unknown } })?.message
      ?.content;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) {
      return NextResponse.json(
        { error: 'Model returned no description' },
        { status: 502 }
      );
    }
    return NextResponse.json({ description: text });
  } catch (error) {
    console.error('POST /api/ai/generate-description error:', error);
    const message =
      error instanceof Error ? error.message : 'Generate description failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
