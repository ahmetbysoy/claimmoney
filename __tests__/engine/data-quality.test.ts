import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

describe('DataQualityGate', () => {
  it('should validate clean data', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100.5, v: 1000,
    }));
    const report = gate.validate(candles);
    expect(report.totalRows).toBe(100);
    expect(report.score).toBeGreaterThan(90);
  });

  it('should sort and deduplicate', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 3000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 2000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.sortAndDeduplicate(candles);
    expect(result.length).toBe(3);
    expect(result[0].ts).toBe(1000);
    expect(result[2].ts).toBe(3000);
  });

  it('should resync data to fixed interval', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 5000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.resync(candles, 2000);
    expect(result.length).toBeGreaterThan(2);
    expect(result[0].ts).toBe(1000);
  });
});
