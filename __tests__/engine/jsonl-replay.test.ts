import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { Candle, ReplayConfig } from '@/lib/engine/types';

describe('JSONLReplay', () => {
  it('should load JSONL file correctly', () => {
    const replay = new JSONLReplay();
    const line1 = JSON.stringify({ts:1000,o:100,h:105,l:98,c:103,v:1000});
    const line2 = JSON.stringify({ts:1060000,o:103,h:108,l:101,c:106,v:1200});
    const content = line1 + '\n' + line2;
    const candles = replay.loadFile(content);
    expect(candles.length).toBe(2);
    expect(candles[0].c).toBe(103);
    expect(candles[1].v).toBe(1200);
  });

  it('should replay candles deterministically', () => {
    const replay = new JSONLReplay();
    const candles = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000,
      o: 100 + i * 0.1,
      h: 100 + i * 0.1 + 1,
      l: 100 + i * 0.1 - 1,
      c: 100 + (i + 1) * 0.1,
      v: 1000,
    }));
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const r1 = replay.replay(candles, config);
    const r2 = replay.replay(candles, config);
    expect(r1.byteChecksum).toBe(r2.byteChecksum);
  });

  it('should export result as JSON', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const result = replay.replay([], config);
    const exported = replay.exportResult(result);
    const parsed = JSON.parse(exported);
    expect(parsed).toHaveProperty('finalEquity');
    expect(parsed).toHaveProperty('byteChecksum');
  });
});
