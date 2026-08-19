import { describe, it, expect, beforeEach } from 'vitest';
import { QuoteManipulationDetector } from '@/lib/engine/detectors/quoteManipulationDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  return {
    bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
    lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: 5000,
    ...overrides,
  };
}

describe('QuoteManipulationDetector', () => {
  let d: QuoteManipulationDetector;
  beforeEach(() => { d = new QuoteManipulationDetector(); });

  it('should be neutral with no walls', () => {
    const result = d.detect(makeCtx());
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect bid wall pull → bullish', () => {
    // Tick 1: Large bid wall appears
    const ctx1 = makeCtx({
      bids: [{ price: 99, qty: 1000 }], eventTs: 1000,
    });
    d.detect(ctx1);
    // Tick 2-6: Wall stays (high refresh count)
    for (let i = 2; i <= 6; i++) {
      d.detect(makeCtx({
        bids: [{ price: 99, qty: 1000 }], eventTs: i * 500,
      }));
    }
    // Tick 7: Wall pulled (qty drops below 60% of max)
    const ctxPull = makeCtx({
      bids: [{ price: 99, qty: 100 }], eventTs: 3500,
    });
    const result = d.detect(ctxPull);
    // Bid wall pulled → fake sell pressure removed → bullish
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect high refresh rate spoofing', () => {
    // Rapidly appearing/disappearing ask wall
    for (let i = 0; i < 20; i++) {
      d.detect(makeCtx({
        asks: [{ price: 101, qty: i % 2 === 0 ? 2000 : 500 }],
        eventTs: 1000 + i * 200,
      }));
    }
    const result = d.detect(makeCtx({
      asks: [{ price: 101, qty: 500 }], eventTs: 5000,
    }));
    // Ask spoof → fake buy pressure → bearish
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should reset cleanly', () => {
    for (let i = 0; i < 5; i++) {
      d.detect(makeCtx({ bids: [{ price: 99, qty: 1000 }], eventTs: i * 500 }));
    }
    d.reset();
    const result = d.detect(makeCtx({ bids: [{ price: 99, qty: 100 }], eventTs: 5000 }));
    expect(result.side).toBe('neutral');
  });
});
