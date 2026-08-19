import { describe, it, expect } from 'vitest';
import { FeatureFrameBuilder } from '@/lib/engine/feature-frame';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

const sampleCandles: Candle[] = [];
for (let i = 0; i < 30; i++) {
  const base = 100 + i * 0.5;
  sampleCandles.push(makeCandle(1000 + i * 1000, base, base + 2, base - 2, base + 1, 500 + i * 10));
}

describe('FeatureFrameBuilder', () => {
  it('builds a feature frame with standard features', () => {
    const builder = new FeatureFrameBuilder();
    const frame = builder.buildFrame(sampleCandles, 'BTC-USDT', '1m');
    expect(frame.symbol).toBe('BTC-USDT');
    expect(frame.interval).toBe('1m');
    expect(frame.rows.length).toBe(30);
    // Check that standard features exist
    const lastRow = frame.rows[frame.rows.length - 1];
    expect(lastRow.features).toHaveProperty('sma_10');
    expect(lastRow.features).toHaveProperty('ema_9');
    expect(lastRow.features).toHaveProperty('rsi_14');
    expect(lastRow.features).toHaveProperty('macd');
    expect(lastRow.features).toHaveProperty('bb_upper');
    expect(lastRow.features).toHaveProperty('atr_14');
    expect(lastRow.features).toHaveProperty('vwap');
  });

  it('adds and computes custom features', () => {
    const builder = new FeatureFrameBuilder();
    builder.addCustomFeature('close_range', (candles) =>
      candles.map((c) => c.h - c.l)
    );
    const frame = builder.buildFrame(sampleCandles, 'ETH-USDT', '1m');
    const lastRow = frame.rows[frame.rows.length - 1];
    expect(lastRow.features['close_range']).toBeGreaterThan(0);
  });

  it('handles empty input gracefully', () => {
    const builder = new FeatureFrameBuilder();
    const frame = builder.buildFrame([], 'BTC-USDT', '1m');
    expect(frame.symbol).toBe('BTC-USDT');
    expect(frame.rows.length).toBe(0);
  });
});
