import { describe, it, expect } from 'vitest';
import { WalkForwardAnalyzer } from '@/lib/engine/walk-forward';
import type { Candle, RiskConfig } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

const data: Candle[] = [];
for (let i = 0; i < 100; i++) {
  const base = 100 + Math.sin(i * 0.2) * 5 + i * 0.1;
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

describe('WalkForwardAnalyzer', () => {
  it('analyzes data with walk-forward windows', () => {
    const wf = new WalkForwardAnalyzer();
    const result = wf.analyze(
      data,
      { windowSize: 40, stepSize: 20, trainRatio: 0.7 },
      'test',
      { threshold: [1, 2] },
      riskConfig
    );
    expect(result.windows.length).toBeGreaterThanOrEqual(1);
    expect(typeof result.aggregatedSharpe).toBe('number');
    expect(typeof result.aggregatedWinRate).toBe('number');
  });

  it('determines robustness based on OOS metrics', () => {
    const wf = new WalkForwardAnalyzer();
    const result = wf.analyze(
      data,
      { windowSize: 40, stepSize: 40, trainRatio: 0.7 },
      'test',
      { threshold: [1, 3] },
      riskConfig
    );
    // isRobust should be a boolean
    expect(typeof result.isRobust).toBe('boolean');
  });
});
