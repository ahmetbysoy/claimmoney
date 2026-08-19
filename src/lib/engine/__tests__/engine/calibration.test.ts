import { describe, it, expect } from 'vitest';
import { Calibrator } from '@/lib/engine/calibration';
import type { Candle, RiskConfig } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

const data: Candle[] = [];
for (let i = 0; i < 50; i++) {
  const base = 100 + Math.sin(i * 0.3) * 5 + i * 0.2;
  data.push(makeCandle(1000 + i * 60000, base, base + 1, base - 1, base + 0.5, 1000));
}

const riskConfig: RiskConfig = {
  equity: 10000,
  maxRiskPerTrade: 0.02,
  maxOpenPositions: 3,
  maxDailyLoss: 500,
  maxCorrelationExposure: 2,
  defaultStopLossATR: 1.5,
  defaultTP1R: 1,
  defaultTP2R: 2,
};

describe('Calibrator', () => {
  it('calibrates parameters and returns results sorted by Sharpe', () => {
    const cal = new Calibrator();
    const results = cal.calibrate(
      'test_detector',
      { threshold: [1, 3], period: [10, 20] },
      data,
      riskConfig
    );
    expect(results.length).toBeGreaterThan(0);
    // Results should be sorted by Sharpe descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i].sharpeRatio).toBeLessThanOrEqual(results[i - 1].sharpeRatio);
    }
  });

  it('returns the best result correctly', () => {
    const cal = new Calibrator();
    const results = cal.calibrate(
      'test',
      { threshold: [1, 2] },
      data,
      riskConfig
    );
    const best = cal.getBestResult(results);
    expect(best.sharpeRatio).toBeGreaterThanOrEqual(results[results.length - 1].sharpeRatio);
    expect(best.detector).toBe('test');
  });
});
