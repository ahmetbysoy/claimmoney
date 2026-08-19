import { describe, it, expect } from 'vitest';
import { DetectorAggregator } from '@/lib/engine/strategy/detectorAggregator';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const makeCtx = (overrides?: Partial<DetectorContext>): DetectorContext => ({
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
  ...overrides,
});

describe('DetectorAggregator (strategy)', () => {
  it('should return aggregator as detector name', () => {
    const agg = new DetectorAggregator();
    const r = agg.run(makeCtx());
    expect(r.detector).toBe('aggregator');
  });

  it('should be neutral with empty book', () => {
    const agg = new DetectorAggregator();
    const r = agg.run(makeCtx());
    expect(r.side).toBe('neutral');
    expect(r.confidence).toBe(0);
    expect(r.evidence).toHaveProperty('bullScore');
    expect(r.evidence).toHaveProperty('bearScore');
  });

  it('should aggregate multiple detector signals', () => {
    const agg = new DetectorAggregator();
    const r = agg.run(makeCtx({
      bids: [{ price: 100, qty: 10000 }, { price: 99, qty: 5000 }],
      asks: [{ price: 101, qty: 100 }],
      lastFlowDelta: 100000,
      lastFlowVolume: 200000,
    }));
    expect(r.detector).toBe('aggregator');
    expect(r.side).toBeDefined();
    expect(typeof r.confidence).toBe('number');
  });

  it('should have reset method', () => {
    const agg = new DetectorAggregator();
    expect(typeof agg.reset).toBe('function');
    agg.reset();
  });
});
