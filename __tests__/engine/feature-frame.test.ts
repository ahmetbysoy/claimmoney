import { describe, it, expect } from 'vitest';
import { FeatureFrameBuilder } from '@/lib/engine/feature-frame';
import type { Candle } from '@/lib/engine/types';

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    ts: 1000 + i * 60000,
    o: 100 + i * 0.5,
    h: 100 + i * 0.5 + 2,
    l: 100 + i * 0.5 - 2,
    c: 100 + (i + 1) * 0.5,
    v: 1000 + i * 100,
  }));
}

describe('FeatureFrameBuilder', () => {
  it('should build frame with standard features', () => {
    const builder = new FeatureFrameBuilder();
    const candles = makeCandles(50);
    const frame = builder.buildFrame(candles, 'BTC-USDT', '1m');
    expect(frame.symbol).toBe('BTC-USDT');
    expect(frame.interval).toBe('1m');
    expect(frame.rows.length).toBe(50);
    expect(frame.rows[0].features).toHaveProperty('rsi_14');
    expect(frame.rows[0].features).toHaveProperty('atr_14');
    expect(frame.rows[0].features).toHaveProperty('vwap');
  });

  it('should support custom features', () => {
    const builder = new FeatureFrameBuilder();
    builder.addCustomFeature('double_close', (candles) =>
      candles.map((c) => c.c * 2)
    );
    const frame = builder.buildFrame(makeCandles(10), 'BTC', '1m');
    expect(frame.rows[9].features.double_close).toBe(makeCandles(10)[9].c * 2);
  });

  it('should return empty frame for empty input', () => {
    const builder = new FeatureFrameBuilder();
    const frame = builder.buildFrame([], 'BTC', '1m');
    expect(frame.rows).toEqual([]);
  });
});
