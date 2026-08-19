import { describe, it, expect } from 'vitest';
import { SkewDetector } from '@/lib/engine/detectors/skewDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  return { bids: [], asks: [], mid: 0, spread: 0, bestBid: 0, bestAsk: 0, ...overrides as Partial<DetectorContext> };
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
