import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { Candle, ReplayConfig } from '@/lib/engine/types';

describe('Snapshot/Delta Mode', () => {
  const makeCandles = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({
    ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100 + i * 0.1, v: 1000,
  }));

  it('should produce snapshots in replay', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const result = replay.replay(makeCandles(50), config);
    expect(result.snapshots.length).toBe(50);
    expect(result.snapshots[0]).toHaveProperty('equity');
    expect(result.snapshots[0]).toHaveProperty('regime');
  });

  it('should produce consistent deltas between runs', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const candles = makeCandles(30);
    const r1 = replay.replay(candles, config);
    const r2 = replay.replay(candles, config);
    const d1 = r1.snapshots.map(s => s.equity);
    const d2 = r2.snapshots.map(s => s.equity);
    expect(d1).toEqual(d2);
  });
});
