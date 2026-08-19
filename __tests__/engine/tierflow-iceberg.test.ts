import { describe, it, expect, beforeEach } from 'vitest';
import { IcebergDetector } from '@/lib/engine/detectors/icebergDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
};

describe('IcebergDetector', () => {
  let d: IcebergDetector;

  beforeEach(() => { d = new IcebergDetector(); });

  it('should be neutral with no volume', () => {
    const ctx: DetectorContext = { ...baseCtx, lastFlowDelta: 0, lastFlowVolume: 0 };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect iceberg with high ratio', () => {
    const ctx: DetectorContext = {
      ...baseCtx,
      bids: [{ price: 100, qty: 100 }],
      asks: [{ price: 100, qty: 100 }],
      lastFlowVolume: 50000,
      lastFlowDelta: -10000,
    };
    const result = d.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
