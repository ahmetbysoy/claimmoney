import { NextResponse } from 'next/server';
import { RiskPlanner } from '@/lib/engine/risk-planner';
import type { RiskConfig } from '@/lib/engine/types';

const defaultConfig: RiskConfig = {
  equity: 10000,
  maxRiskPerTrade: 0.01,
  maxOpenPositions: 5,
  maxDailyLoss: 0.03,
  maxCorrelationExposure: 0.5,
  defaultStopLossATR: 1.5,
  defaultTP1R: 1,
  defaultTP2R: 2,
};

export async function GET() {
  return NextResponse.json({ config: defaultConfig });
}

export async function POST(req: Request) {
  const body = await req.json();
  const planner = new RiskPlanner();
  const { entryPrice, stopLoss, equity, riskPct } = body;
  const cfg = { ...defaultConfig, equity: equity ?? 10000, maxRiskPerTrade: riskPct ?? 0.01 };
  const positionSize = planner.calculatePositionSize(cfg, entryPrice, stopLoss);
  return NextResponse.json({ positionSize });
}