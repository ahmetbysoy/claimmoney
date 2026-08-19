import { describe, it, expect, beforeEach } from 'vitest';
import { DetectorAggregator } from '@/lib/engine/strategy/detectorAggregator';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const makeCtx = (overrides?: Partial<DetectorContext>): DetectorContext => ({
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
  ...overrides,
});

describe('DetectorAggregator', () => {
  let a: DetectorAggregator;

  beforeEach(() => { a = new DetectorAggregator(); });

  it('should aggregate detector signals', () => {
    const r = a.run(makeCtx());
    expect(r.detector).toBe('aggregator');
    expect(r.side).toBeDefined();
    expect(r.evidence).toHaveProperty('bullScore');
    expect(r.evidence).toHaveProperty('bearScore');
  });

  it('should be neutral when no signals', () => {
    const r = a.run(makeCtx());
    expect(r.side).toBe('neutral');
    expect(r.confidence).toBe(0);
  });
});
