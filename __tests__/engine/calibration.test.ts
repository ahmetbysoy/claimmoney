import { describe, it, expect } from 'vitest';
import { Calibrator } from '@/lib/engine/calibration';
import type { RiskConfig, Candle } from '@/lib/engine/types';

describe('Calibrator', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should calibrate detector parameters', () => {
    const cal = new Calibrator();
    const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 100 + 1, l: 100 - 1, c: 100 + (i % 2 === 0 ? 0.5 : -0.5), v: 1000,
    }));
    const results = cal.calibrate('test', { period: [10, 30] }, candles, config, 3);
    expect(results.length).toBe(3);
    expect(results[0]).toHaveProperty('sharpeRatio');
  });

  it('should return best result by Sharpe', () => {
    const cal = new Calibrator();
    const results = [
      { detector: 't', paramSet: {}, sharpeRatio: 1.0, maxDrawdown: 0.1, winRate: 0.5, profitFactor: 1.2, totalTrades: 10 },
      { detector: 't', paramSet: {}, sharpeRatio: 2.0, maxDrawdown: 0.05, winRate: 0.6, profitFactor: 1.5, totalTrades: 10 },
      { detector: 't', paramSet: {}, sharpeRatio: 0.5, maxDrawdown: 0.15, winRate: 0.4, profitFactor: 0.8, totalTrades: 10 },
    ];
    const best = cal.getBestResult(results);
    expect(best.sharpeRatio).toBe(2.0);
  });
});
