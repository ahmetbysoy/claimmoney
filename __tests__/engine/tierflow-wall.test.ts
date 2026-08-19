import { describe, it, expect } from 'vitest';
import { WallDetector } from '@/lib/engine/detectors/wallDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

function makeCtx(overrides?: Partial<DetectorContext>): DetectorContext {
  // Generate 5 small bid + 5 small ask levels as noise floor
  const smallBids = Array.from({ length: 5 }, (_, i) => ({ price: 100 - (i + 1) * 0.1, qty: 100 }));
  const smallAsks = Array.from({ length: 5 }, (_, i) => ({ price: 101 + (i + 1) * 0.1, qty: 100 }));
  return {
    bids: smallBids, asks: smallAsks, mid: 100.5, spread: 1, bestBid: 99.9, bestAsk: 100.1,
    lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
    ...overrides as Partial<DetectorContext>,
  };
}

describe('WallDetector', () => {
  it('should have name wall', () => {
    const det = new WallDetector();
    expect(det.name).toBe('wall');
  });

  it('should detect bid wall', () => {
    const det = new WallDetector();
    const bids = [
      { price: 99.9, qty: 100 }, { price: 99.8, qty: 100 }, { price: 99.7, qty: 100 },
      { price: 99.6, qty: 100 }, { price: 99.5, qty: 50000 }, // wall
    ];
    const ctx = makeCtx({ bids });
    const result = det.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect ask wall', () => {
    const det = new WallDetector();
    const asks = [
      { price: 100.1, qty: 100 }, { price: 100.2, qty: 100 }, { price: 100.3, qty: 100 },
      { price: 100.4, qty: 100 }, { price: 100.5, qty: 50000 }, // wall
    ];
    const ctx = makeCtx({ asks });
    const result = det.detect(ctx);
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should return neutral for no walls', () => {
    const det = new WallDetector();
    const ctx = makeCtx(); // all small levels
    const result = det.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should be opposite sides for bid vs ask wall', () => {
    const det = new WallDetector();
    const wallBids = [
      { price: 99.9, qty: 100 }, { price: 99.8, qty: 100 }, { price: 99.7, qty: 100 },
      { price: 99.6, qty: 100 }, { price: 99.5, qty: 50000 },
    ];
    const wallAsks = [
      { price: 100.1, qty: 100 }, { price: 100.2, qty: 100 }, { price: 100.3, qty: 100 },
      { price: 100.4, qty: 100 }, { price: 100.5, qty: 50000 },
    ];
    const ctx1 = makeCtx({ bids: wallBids });
    const ctx2 = makeCtx({ asks: wallAsks });
    const r1 = det.detect(ctx1);
    const r2 = det.detect(ctx2);
    expect(r1.detector).toBe(r2.detector);
    expect(r1.side).not.toBe(r2.side);
  });

  it('should detect compression', () => {
    const det = new WallDetector();
    const bigBids = [
      { price: 99.9, qty: 100 }, { price: 99.8, qty: 100 }, { price: 99.7, qty: 100 },
      { price: 99.6, qty: 100 }, { price: 99.5, qty: 50000 },
    ];
    const bigAsks = [
      { price: 100.1, qty: 100 }, { price: 100.2, qty: 100 }, { price: 100.3, qty: 100 },
      { price: 100.4, qty: 100 }, { price: 100.5, qty: 50000 },
    ];
    const ctx = makeCtx({ bids: bigBids, asks: bigAsks });
    const result = det.detect(ctx);
    expect(result.detector).toBe('compression');
    expect(result.side).toBe('neutral');
  });

  it('should reset', () => {
    const det = new WallDetector();
    det.reset();
    const ctx = makeCtx();
    expect(det.detect(ctx).side).toBe('neutral');
  });
});
