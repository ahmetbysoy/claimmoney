import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { ReplayConfig, ReplaySnapshot } from '@/lib/engine/types';

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

describe('Snapshot/Delta mode', () => {
  it('produces snapshots with correct structure', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    const result = replay.replay(candles, baseConfig);

    for (const snap of result.snapshots) {
      expect(snap).toHaveProperty('ts');
      expect(snap).toHaveProperty('equity');
      expect(snap).toHaveProperty('positions');
      expect(snap).toHaveProperty('signals');
      expect(snap).toHaveProperty('regime');
      expect(Array.isArray(snap.positions)).toBe(true);
    }
    expect(result.snapshots.length).toBe(3);
  });

  it('exports snapshots as JSONL with summary', () => {
    const replay = new JSONLReplay();
    const candles = replay.loadFile(jsonlContent);
    const result = replay.replay(candles, baseConfig);
    const exported = replay.exportResult(result);

    const lines = exported.trim().split('\n');
    // 3 snapshot lines + 1 summary line
    expect(lines.length).toBe(4);

    const summary = JSON.parse(lines[lines.length - 1]);
    expect(summary._summary).toBe(true);
    expect(summary).toHaveProperty('finalEquity');
    expect(summary).toHaveProperty('byteChecksum');
  });
});
