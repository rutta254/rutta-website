import { NextResponse } from 'next/server';

// Set your live Render service URL (or read from environment variables)
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || 'https://your-render-app.onrender.com/api/analyze';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward the request body directly to Render
    const res = await fetch(RENDER_BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: `Render server returned status ${res.status}: ${errorText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Backend Proxy Error: ${message}` }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    supported_element_types: ['beam', 'column', 'truss', 'plate'],
    supported_beam_supports: ['simply_supported', 'cantilever', 'fixed_fixed'],
  });
}