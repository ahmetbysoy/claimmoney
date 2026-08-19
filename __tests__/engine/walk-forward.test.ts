import { describe, it, expect } from 'vitest';
import { WalkForwardAnalyzer } from '@/lib/engine/walk-forward';
import type { RiskConfig, Candle } from '@/lib/engine/types';

describe('WalkForwardAnalyzer', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should perform walk-forward analysis', () => {
    const analyzer = new WalkForwardAnalyzer();
    const candles: Candle[] = Array.from({ length: 200 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100 + (i % 2 === 0 ? 0.3 : -0.3), v: 1000,
    }));
    const result = analyzer.analyze(
      candles,
      { windowSize: 80, stepSize: 40, trainRatio: 0.7 },
      'test', { period: [10, 20] }, config
    );
    expect(result).toHaveProperty('windows');
    expect(result).toHaveProperty('aggregatedSharpe');
    expect(result).toHaveProperty('isRobust');
  });

  it('should export results as JSON', () => {
    const analyzer = new WalkForwardAnalyzer();
    const result = { windows: [], aggregatedSharpe: 1.5, aggregatedMaxDD: 0.1, aggregatedWinRate: 0.55, isRobust: true };
    const exported = analyzer.exportResults(result);
    const parsed = JSON.parse(exported);
    expect(parsed.aggregatedSharpe).toBe(1.5);
  });
});
