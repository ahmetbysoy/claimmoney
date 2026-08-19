import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

describe('Resync', () => {
  it('should resample up (fill gaps)', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 0, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 60000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 180000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.resync(candles, 60000);
    expect(result.length).toBe(4); // 0, 60k, 120k (filled), 180k
  });

  it('should handle resample down correctly', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      ts: i * 30000, o: 100, h: 101, l: 99, c: 100, v: 1000,
    }));
    const result = gate.resync(candles, 60000);
    expect(result.length).toBeGreaterThan(5);
  });
});
