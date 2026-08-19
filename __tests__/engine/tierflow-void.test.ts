import { describe, it, expect } from 'vitest';
import { LiquidityVoidDetector } from '@/lib/engine/detectors/liquidityVoidDetector';

function makeCtx(overrides?: Record<string, unknown>): Record<string, unknown> {
  return { bids: [], asks: [], mid: 0, spread: 0, bestBid: 0, bestAsk: 0, ...overrides as Record<string, unknown> };
}

describe('LiquidityVoidDetector', () => {
  beforeEach(() => { const d = new LiquidityVoidDetector(); });

  it('should return neutral for no gaps', () => {
    const ctx = makeCtx({ bids: [{ price: 100, qty: 100 }], asks: [{ price: 100, qty: 100 }], mid: 100 });
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

describe('should detect void below ask', () => {
    const ctx = makeCtx({
      bids: [{ price: 100, qty: 100 }],
      asks: [{ price: 105, qty: 100 }],
    });
    const result = d.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
