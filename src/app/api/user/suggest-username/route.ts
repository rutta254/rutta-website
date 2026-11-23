import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Generate 6 creative username suggestions for someone named "${name}". 
Rules: lowercase only, letters/numbers/underscores/dots, 3-20 characters, no spaces.
Reply with ONLY a JSON array of strings, nothing else. Example: ["name_one","name.two","name123"]`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? '[]';
    const suggestions = JSON.parse(text);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Username suggestion error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}