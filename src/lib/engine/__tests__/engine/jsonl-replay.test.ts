import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { ReplayConfig } from '@/lib/engine/types';

const jsonlContent = [
  JSON.stringify({ ts: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 }),
  JSON.stringify({ ts: 2000, o: 102, h: 108, l: 101, c: 107, v: 2000 }),
  JSON.stringify({ ts: 3000, o: 107, h: 110, l: 106, c: 109, v: 1500 }),
  JSON.stringify({ ts: 4000, o: 109, h: 112, l: 108, c: 111, v: 1800 }),
  JSON.stringify({ ts: 5000, o: 111, h: 115, l: 110, c: 114, v: 2200 }),
].join('\n');

const baseConfig: ReplayConfig = {
  source: 'test',
  startTime: 0,
  endTime: 99999,
  speed: 1,
  deterministic: true,
};

describe('JSONLReplay', () => {
  it('loads a JSONL file and parses candles', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    expect(candles.length).toBe(5);
    expect(candles[0].o).toBe(100);
    expect(candles[4].c).toBe(114);
  });

  it('replays candles and produces snapshots', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    const result = replay.replay(candles, baseConfig);
    expect(result.snapshots.length).toBe(5);
    expect(result.finalEquity).toBe(10000);
    expect(result.byteChecksum).toBeTruthy();
  });

  it('produces byte-equivalent results for same input', () => {
    const replay1 = new JSONLReplay();
    const replay2 = new JSONLReplay();
    const candles = replay1.loadFile(jsonlContent);
    const result1 = replay1.replay(candles, baseConfig);
    const result2 = replay2.replay(candles, baseConfig);
    expect(result1.byteChecksum).toBe(result2.byteChecksum);
  });
});
