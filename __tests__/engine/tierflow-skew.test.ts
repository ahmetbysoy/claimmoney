import { describe, it, expect, beforeEach } from 'vitest';
import { SkewDetector } from '@/lib/engine/detectors/skewDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  return {
    bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
    lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
    ...overrides,
  };
}

describe('SkewDetector', () => {
  beforeEach(() => {
    const det = new SkewDetector();
    expect(det.name).toBe('skew');
  });

  it('should detect bullish skew', () => {
    const det = new SkewDetector();
    const ctx = makeCtx({
      bids: [{ price: 100, qty: 10000 }],
      asks: [{ price: 100, qty: 100 }],
    });
    const result = det.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
