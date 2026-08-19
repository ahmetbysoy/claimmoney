import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

describe('DataQualityGate', () => {
  it('validates clean data with high score', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [];
    for (let i = 0; i < 20; i++) {
      candles.push(makeCandle(1000 + i * 60000, 100 + i, 102 + i, 98 + i, 101 + i, 1000));
    }
    const report = gate.validate(candles);
    expect(report.totalRows).toBe(20);
    expect(report.validRows).toBe(20);
    expect(report.invalidRows).toBe(0);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  it('sorts and deduplicates candles', () => {
    const gate = new DataQualityGate();
    const candles = [
      makeCandle(3000, 103, 105, 101, 104, 300),
      makeCandle(1000, 100, 102, 98, 101, 100),
      makeCandle(2000, 101, 103, 99, 102, 200),
      makeCandle(1000, 100, 102, 98, 101, 100), // duplicate
    ];
    const result = gate.sortAndDeduplicate(candles);
    expect(result.length).toBe(3);
    expect(result[0].ts).toBe(1000);
    expect(result[1].ts).toBe(2000);
    expect(result[2].ts).toBe(3000);
  });

  it('resyncs candles to a fixed interval', () => {
    const gate = new DataQualityGate();
    const candles = [
      makeCandle(1000, 100, 102, 98, 101, 100),
      makeCandle(1500, 101, 103, 99, 102, 50),
      makeCandle(2000, 102, 104, 100, 103, 100),
      makeCandle(2500, 103, 105, 101, 104, 50),
      makeCandle(3000, 104, 106, 102, 105, 100),
    ];
    const resynced = gate.resync(candles, 2000);
    // Should produce 2 candles: [1000, 3000) and [3000, 5000)
    expect(resynced.length).toBe(2);
    expect(resynced[0].ts).toBe(0); // aligned to 2000 boundary from 1000 start
    expect(resynced[0].v).toBe(150); // 100 + 50
  });
});
