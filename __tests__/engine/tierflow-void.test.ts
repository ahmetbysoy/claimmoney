import { describe, it, expect, beforeEach } from 'vitest';
import { LiquidityVoidDetector } from '@/lib/engine/detectors/liquidityVoidDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  return {
    bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
    lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
    ...overrides,
  };
}

describe('LiquidityVoidDetector', () => {
  let d: LiquidityVoidDetector;

  beforeEach(() => { d = new LiquidityVoidDetector(); });

  it('should return neutral for no gaps', () => {
    const ctx = makeCtx({
      bids: [
        { price: 100, qty: 100 },
        { price: 101, qty: 100 },
        { price: 102, qty: 100 },
      ],
      asks: [{ price: 103, qty: 100 }],
    });
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect void in ask side (bullish — vacuum above)', () => {
    const ctx = makeCtx({
      bids: [{ price: 100, qty: 100 }],
      asks: [
        { price: 100.5, qty: 100 },
        { price: 101, qty: 100 },
        { price: 120, qty: 100 },
        { price: 121, qty: 100 },
      ],
    });
    const result = d.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect void in bid side (bearish — vacuum below)', () => {
    const ctx = makeCtx({
      bids: [
        { price: 100, qty: 100 },
        { price: 99, qty: 100 },
        { price: 80, qty: 100 },
        { price: 79, qty: 100 },
      ],
      asks: [{ price: 100.5, qty: 100 }],
    });
    const result = d.detect(ctx);
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
