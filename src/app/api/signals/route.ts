import { NextResponse } from 'next/server';

let signals: unknown[] = [];

export async function GET() {
  return NextResponse.json({ signals });
}

export async function POST(req: Request) {
  const signal = await req.json();
  signals.push(signal);
  return NextResponse.json({ ok: true, signal });
}
