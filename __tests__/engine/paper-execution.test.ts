import { describe, it, expect, beforeEach } from 'vitest';
import { PaperExecution } from '@/lib/engine/paper-execution';
import { FeeAccounting } from '@/lib/engine/fee-accounting';
import type { RiskConfig, Signal } from '@/lib/engine/types';

describe('PaperExecution', () => {
  let config: RiskConfig;
  let executor: PaperExecution;

  beforeEach(() => {
    config = {
      equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
      maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
      defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
    };
    executor = new PaperExecution(new FeeAccounting(), config);
  });

  it('should execute a signal and create position', () => {
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    const pos = executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config);
    expect(pos).not.toBeNull();
    expect(pos!.status).toBe('open');
    expect(pos!.side).toBe('long');
  });

  it('should update position PnL', () => {
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    const pos = executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config)!;
    executor.updatePosition(pos, 105);
    expect(executor.getOpenPositions()[0].pnl).toBeGreaterThan(0);
  });

  it('should track equity correctly', () => {
    expect(executor.getEquity()).toBe(10000);
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config);
    const eq = executor.getEquity();
    expect(eq).toBeGreaterThan(0);
  });
});
