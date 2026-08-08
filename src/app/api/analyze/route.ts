import { NextResponse } from 'next/server';

const RAW_BACKEND_URL =
  process.env.RENDER_BACKEND_URL || 'https://rutta-backend.onrender.com';

const BASE_URL = RAW_BACKEND_URL.replace(/\/+$/, '').replace(/\/api\/analyze$/, '');
const TARGET_API_URL = `${BASE_URL}/api/analyze`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isPdfRequest = body.action === 'pdf';

    const res = await fetch(TARGET_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Backend response error [${res.status}]:`, errorText);
      return NextResponse.json(
        { error: `Render Python server error (${res.status}): ${errorText || res.statusText}` },
        { status: res.status }
      );
    }

    // Handle PDF Binary stream return back to frontend
    if (isPdfRequest) {
      const pdfBuffer = await res.arrayBuffer();
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename=rutta_structural_report.pdf',
        },
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proxy connection failure to Python backend:', message);

    return NextResponse.json(
      { error: `Failed to connect to Python backend. Details: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    proxy_target: TARGET_API_URL,
  });
}