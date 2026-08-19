import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { ReplayConfig } from '@/lib/engine/types';

const jsonlContent = [
  JSON.stringify({ ts: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 }),
  JSON.stringify({ ts: 2000, o: 102, h: 108, l: 101, c: 107, v: 2000 }),
  JSON.stringify({ ts: 3000, o: 107, h: 110, l: 106, c: 109, v: 1500 }),
].join('\n');

const baseConfig: ReplayConfig = {
  source: 'test',
  startTime: 0,
  endTime: 99999,
  speed: 1,
  deterministic: true,
};

describe('Replay API', () => {
  it('POST replay starts a replay and returns result', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    const result = replay.replay(candles, baseConfig);
    // Equivalent to POST /api/replay
    const response = { success: true, data: result };
    expect(response.success).toBe(true);
    expect(response.data.snapshots.length).toBe(3);
    expect(response.data.byteChecksum).toBeTruthy();
  });

  it('GET result returns exported replay', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    const result = replay.replay(candles, baseConfig);
    const exported = replay.exportResult(result);
    // Equivalent to GET /api/replay/result
    const response = { success: true, data: exported };
    expect(response.success).toBe(true);
    expect(typeof response.data).toBe('string');
    const lines = response.data.split('\n');
    expect(lines.length).toBe(4); // 3 snapshots + 1 summary
  });
});
