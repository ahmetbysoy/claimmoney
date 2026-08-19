import { describe, it, expect } from 'vitest';
import { RiskPlanner } from '@/lib/engine/risk-planner';
import type { RiskConfig, Position, Signal } from '@/lib/engine/types';

describe('RiskPlanner', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should calculate position size correctly', () => {
    const planner = new RiskPlanner();
    const size = planner.calculatePositionSize(config, 100, 98);
    expect(size).toBe(50); // 10000 * 0.01 / 2 = 50
  });

  it('should calculate stop loss from ATR', () => {
    const planner = new RiskPlanner();
    const sl = planner.calculateStopLoss(100, 2, 1.5);
    expect(sl).toBe(97);
  });

  it('should check risk constraints', () => {
    const planner = new RiskPlanner();
    const positions: Position[] = Array.from({ length: 5 }, (_, i) => ({
      id: 'p' + i, symbol: 'BTC', side: 'long' as const, entryPrice: 100,
      currentPrice: 101, size: 1, stopLoss: 98, takeProfit1: 104,
      takeProfit2: 106, fee: 1, slippage: 0, pnl: 1, rMultiple: 0.5,
      status: 'open' as const, entryTs: 1000,
    }));
    const signal: Signal = { id: 's1', ts: 2000, detector: 't', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    expect(planner.checkRisk(config, positions, signal)).toBe(false);
    expect(planner.checkRisk(config, positions.slice(0, 2), signal)).toBe(true);
  });
});
