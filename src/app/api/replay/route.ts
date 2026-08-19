import { NextResponse } from 'next/server';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { ReplayConfig, Candle } from '@/lib/engine/types';

let lastResult: unknown = null;

export async function GET() {
  return NextResponse.json({ result: lastResult });
}

export async function POST(req: Request) {
  const body = await req.json();
  const candles = (body.candles ?? []) as Candle[];
  const config: ReplayConfig = {
    source: body.source ?? 'api',
    startTime: body.startTime ?? 0,
    endTime: body.endTime ?? Infinity,
    speed: body.speed ?? 1,
    deterministic: body.deterministic ?? true,
  };
  const replay = new JSONLReplay();
  const result = replay.replay(candles, config);
  lastResult = result;
  return NextResponse.json(result);
}