import { NextResponse } from 'next/server';
import { MarketRuntime } from '@/lib/engine/market-runtime';

const runtime = new MarketRuntime();

export async function GET() {
  const state = runtime.getState();
  const stats = runtime.getStatistics();
  return NextResponse.json({ state, statistics: stats });
}

export async function POST(req: Request) {
  const body = await req.json();
  runtime.processCandle(body);
  const state = runtime.getState();
  return NextResponse.json({ ok: true, currentPrice: state.currentPrice });
}