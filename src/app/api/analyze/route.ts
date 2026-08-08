import { NextResponse } from 'next/server';

// Get base URL or endpoint from environment variable, fallback to default Render service
const RAW_BACKEND_URL =
  process.env.RENDER_BACKEND_URL || 'https://rutta-backend.onrender.com';

// Ensure the URL correctly points to /api/analyze without double paths
const TARGET_API_URL = RAW_BACKEND_URL.endsWith('/api/analyze')
  ? RAW_BACKEND_URL
  : `${RAW_BACKEND_URL.replace(/\/+$/, '')}/api/analyze`;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Forward the request body directly to the Python backend on Render
    const res = await fetch(TARGET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      // Prevent infinite caching on API requests
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(
        `Backend response error [${res.status}] from ${TARGET_API_URL}:`,
        errorText
      );

      return NextResponse.json(
        {
          error: `Render Python server error (${res.status}): ${
            errorText || res.statusText
          }`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy connection failure to Python backend:', message);

    return NextResponse.json(
      {
        error: `Failed to connect to Python backend. Ensure Render service is active at ${TARGET_API_URL}. Details: ${message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    proxy_target: TARGET_API_URL,
    supported_element_types: ['beam', 'column', 'truss_2d'],
    supported_beam_supports: ['simply_supported', 'cantilever', 'fixed_fixed'],
  });
}