import { NextResponse } from 'next/server';

function generateSuggestions(name: string): string[] {
  const clean = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/);
  const first = parts[0] ?? 'user';
  const last = parts[1] ?? '';
  const year = new Date().getFullYear().toString().slice(-2);
  const num = Math.floor(Math.random() * 900) + 100;

  const suggestions: string[] = [];

  if (last) {
    suggestions.push(`${first}.${last}`);
    suggestions.push(`${first}_${last}`);
    suggestions.push(`${first}.${last}${year}`);
    suggestions.push(`${first[0]}.${last}`);
    suggestions.push(`${last}.${first}`);
  }

  suggestions.push(`${first}${num}`);
  suggestions.push(`${first}_${num}`);
  suggestions.push(`${first}.ke`);
  suggestions.push(`${first}254`);
  suggestions.push(`${first}_rg`);

  // Deduplicate, enforce format, return 6
  return [...new Set(suggestions)]
    .filter(s => /^[a-z0-9_.]{3,20}$/.test(s))
    .slice(0, 6);
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const suggestions = generateSuggestions(name ?? 'user');
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}