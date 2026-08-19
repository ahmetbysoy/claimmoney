import { describe, it, expect, beforeEach } from 'vitest';
import { WallDetector } from '@/lib/engine/detectors/wallDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  return {
    bids: [], asks: [], mid: 0, spread: 0, bestBid: 0, bestAsk: 0,
    ...overrides as Partial<DetectorContext>,
  };
}

function addLevels(ctx: DetectorContext, side: 'bid' | 'ask', prices: number[], qty: number) {
  ctx[side] = prices.map((p, i) => ({ price: p + (side === 'bid' ? 0.01 : -0.01), qty: qty * (i + 1) * 1000 }));
}

describe('WallDetector', () => {
  beforeEach(() => {
    const det = new WallDetector();
    expect(det.name).toBe('wall');
    expect(typeof det.detect).toBe('function');
  });

  it('should detect bid wall', () => {
    const ctx = makeCtx({ bids: [{ price: 100, qty: 30000 }], asks: [{ price: 101, qty: 1000 }] });
    const result = det.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect ask wall', () => {
    const ctx = makeCtx({ bids: [{ price: 100, qty: 1000 }], asks: [{ price: 100, qty: 50000, ...ctx.spread }] });
    const result = det.detect(ctx);
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect compression (both sides have walls)', () => {
    const ctx = makeCtx({
      bids: [{ price: 99.5, qty: 40000 }, { price: 100, qty: 50000 }],
      asks: [{ price: 100.5, qty: 40000 }, { price: 101, qty: 50000 }],
      mid: 100,
    });
    const result = det.detect(ctx);
    expect(result.detector).toBe('compression');
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBeLessThan(1);
  });

  it('should be symmetrical', () => {
    const ctx1 = makeCtx({ bids: [{ price: 100, qty: 30000 }], asks: [{ price: 101, qty: 1000 }] });
    const ctx2 = makeCtx({ bids: [{ price: 100, qty: 1000 }], asks: [{ price: 100, qty: 30000 }]);
    const r1 = det.detect(ctx1);
    const r2 = det.detect(ctx2);
    expect(r1.detector).toBe(r2.detector);
    expect(r1.side).toBe(r2.side);
  });
});
