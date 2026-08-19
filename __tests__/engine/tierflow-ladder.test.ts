import { describe, it, expect, beforeEach } from 'vitest';
import { LadderDetector } from '@/lib/engine/detectors/ladderDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
};

describe('LadderDetector', () => {
  let d: LadderDetector;

  beforeEach(() => { d = new LadderDetector(); });

  it('should detect bid ladder', () => {
    const ctx: DetectorContext = {
      ...baseCtx,
      bids: [
        { price: 100, qty: 100 }, { price: 101, qty: 10000 }, { price: 102, qty: 100 },
        { price: 103, qty: 100 }, { price: 104, qty: 10000 }, { price: 105, qty: 100 },
        { price: 106, qty: 10000 },
      ],
      asks: [],
    };
    const result = d.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect ask ladder', () => {
    const ctx: DetectorContext = {
      ...baseCtx,
      bids: [],
      asks: [
        { price: 106, qty: 100 }, { price: 105, qty: 10000 }, { price: 104, qty: 100 },
        { price: 103, qty: 100 }, { price: 102, qty: 10000 }, { price: 101, qty: 100 },
        { price: 100, qty: 10000 },
      ],
    };
    const result = d.detect(ctx);
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
