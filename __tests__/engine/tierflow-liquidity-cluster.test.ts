import { describe, it, expect, beforeEach } from 'vitest';
import { LiquidationClusterDetector } from '@/lib/engine/detectors/liquidationClusterDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
};

describe('LiquidationClusterDetector', () => {
  let d: LiquidationClusterDetector;

  beforeEach(() => { d = new LiquidationClusterDetector(); });

  it('should be neutral', () => {
    const ctx: DetectorContext = { ...baseCtx };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });
});
