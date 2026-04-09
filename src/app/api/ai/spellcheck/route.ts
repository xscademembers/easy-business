import { NextResponse } from 'next/server';

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
    const { text } = body as { text?: string };

    if (typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const apiKey = getApiKey();
    const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';

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
              'You correct spelling and grammar only. Preserve meaning and tone. Reply with corrected text only, no quotes or preamble.',
          },
          {
            role: 'user',
            content: text.trim() || '(empty)',
          },
        ],
        max_tokens: 800,
      }),
    });

    const chatJson: unknown = await chatRes.json().catch(() => null);
    if (!chatRes.ok) {
      return NextResponse.json(
        { error: 'Spell check service unavailable' },
        { status: 502 }
      );
    }

    const choices = (chatJson as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const content = (first as { message?: { content?: unknown } })?.message
      ?.content;
    const corrected =
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

    return NextResponse.json({
      corrected: corrected || text.trim(),
    });
  } catch (error) {
    console.error('POST /api/ai/spellcheck error:', error);
    const message =
      error instanceof Error ? error.message : 'Spell check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
