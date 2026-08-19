import { describe, it, expect, beforeEach } from 'vitest';
import { QuoteManipulationDetector } from '@/lib/engine/detectors/quoteManipulationDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
};

describe('QuoteManipulationDetector', () => {
  let d: QuoteManipulationDetector;

  beforeEach(() => { d = new QuoteManipulationDetector(); });

  it('should be neutral', () => {
    const ctx: DetectorContext = { ...baseCtx };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });
});
