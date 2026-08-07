import { NextResponse } from 'next/server';
import { analyzeStructure } from '@/lib/structural';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const analysisResult = analyzeStructure(body);
    return NextResponse.json(analysisResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    supported_element_types: ['beam', 'column', 'truss', 'plate'],
    supported_beam_supports: ['simply_supported', 'cantilever'],
  });
}
