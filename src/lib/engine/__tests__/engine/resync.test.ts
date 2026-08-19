import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

describe('Resync (resample)', () => {
  it('resamples up: many small candles into fewer large ones', () => {
    const gate = new DataQualityGate();
    // 10 candles at 1s interval -> resample to 5s -> 2 buckets
    const candles: Candle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push(makeCandle(i * 1000, 100 + i, 102 + i, 98 + i, 101 + i, 100));
    }
    const resampled = gate.resync(candles, 5000);
    expect(resampled.length).toBe(2);
  });

  it('resamples down: fewer candles into a wider interval', () => {
    const gate = new DataQualityGate();
    // 3 candles at 5s interval -> resample to 10s -> 2 buckets
    const candles = [
      makeCandle(0, 100, 105, 95, 102, 1000),
      makeCandle(5000, 102, 107, 101, 106, 2000),
      makeCandle(10000, 106, 110, 105, 108, 1500),
    ];
    const resampled = gate.resync(candles, 10000);
    expect(resampled.length).toBe(2);
    // First bucket: ts=0, v=1000+2000=3000
    expect(resampled[0].v).toBe(3000);
    // Second bucket: ts=10000, v=1500
    expect(resampled[1].v).toBe(1500);
  });
});
