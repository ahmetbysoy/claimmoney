import { describe, it, expect } from 'vitest';
import { RiskPlanner } from '@/lib/engine/risk-planner';
import type { RiskConfig, Signal, Position } from '@/lib/engine/types';

const defaultConfig: RiskConfig = {
  equity: 10000,
  maxRiskPerTrade: 0.02,
  maxOpenPositions: 5,
  maxDailyLoss: 500,
  maxCorrelationExposure: 3,
  defaultStopLossATR: 1.5,
  defaultTP1R: 1,
  defaultTP2R: 2,
};

describe('RiskPlanner', () => {
  it('calculates position size using fixed fractional risk', () => {
    const planner = new RiskPlanner();
    const size = planner.calculatePositionSize(defaultConfig, 100, 98);
    // Risk amount = 10000 * 0.02 = 200
    // Risk per unit = 100 - 98 = 2
    // Size = 200 / 2 = 100
    expect(size).toBe(100);
  });

  it('calculates stop loss from ATR', () => {
    const planner = new RiskPlanner();
    const sl = planner.calculateStopLoss(100, 2, 1.5);
    expect(sl).toBe(97); // 100 - 2 * 1.5

    const slShort = planner.calculateStopLoss(100, -2, 1.5);
    expect(slShort).toBe(103); // 100 - (-2) * 1.5
  });

  it('checks risk and rejects over-limit positions', () => {
    const planner = new RiskPlanner();
    const openPositions: Position[] = Array(5).fill(null).map((_, i) => ({
      id: `p${i}`,
      symbol: 'BTC',
      side: 'long' as const,
      entryPrice: 100,
      currentPrice: 100,
      size: 1,
      stopLoss: 98,
      takeProfit1: 102,
      takeProfit2: 104,
      fee: 0.1,
      slippage: 0.05,
      pnl: 0,
      rMultiple: 0,
      status: 'open' as const,
      entryTs: 1000,
    }));

    const signal: Signal = {
      id: 's1',
      ts: 2000,
      detector: 'test',
      symbol: 'BTC',
      side: 'long',
      confidence: 0.8,
      regime: 'trending_up',
      metadata: {},
    };

    // 5 open positions = max, should reject
    expect(planner.checkRisk(defaultConfig, openPositions, signal)).toBe(false);

    // Remove one, should accept
    const fewerPositions = openPositions.slice(0, 4);
    expect(planner.checkRisk(defaultConfig, fewerPositions, signal)).toBe(true);
  });
});
