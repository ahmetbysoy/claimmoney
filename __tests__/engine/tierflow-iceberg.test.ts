import { describe, it, expect, beforeEach } from 'vitest';
import { IcebergDetector } from '@/lib/engine/detectors/icebergDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: 100000,
};

describe('IcebergDetector', () => {
  let d: IcebergDetector;

  beforeEach(() => { d = new IcebergDetector(); });

  it('should be neutral with no trades', () => {
    const ctx: DetectorContext = { ...baseCtx };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect iceberg: aggressive sells absorbed by ask depth → bullish', () => {
    // Feed aggressive sell trades totaling 20000 notional
    const now = 100000;
    for (let i = 0; i < 20; i++) {
      d.onTrade(99.5, 'sell', 10, now - 10000 + i * 500);
    }
    // Visible ask depth is very small → sells are being absorbed by hidden bid
    const ctx: DetectorContext = {
      ...baseCtx,
      bids: [{ price: 99.5, qty: 1000 }],
      asks: [{ price: 100.5, qty: 1 }],  // tiny visible ask: 100.5 notional
    };
    const result = d.detect(ctx);
    // sellAbsorption = recentSellVol / visibleAsk = ~19900/100.5 ≈ 198 >> 2
    // buyAbsorption = recentBuyVol / visibleBid = 0 / 99500 = 0
    // sellAbsorption > buyAbsorption → bullish (hidden buyer absorbing sells)
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect iceberg: aggressive buys absorbed by bid depth → bearish', () => {
    const now = 100000;
    for (let i = 0; i < 20; i++) {
      d.onTrade(100.5, 'buy', 10, now - 10000 + i * 500);
    }
    const ctx: DetectorContext = {
      ...baseCtx,
      bids: [{ price: 99.5, qty: 1 }],  // tiny visible bid
      asks: [{ price: 100.5, qty: 1000 }],
    };
    const result = d.detect(ctx);
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
