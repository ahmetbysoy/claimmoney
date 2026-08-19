import { describe, it, expect } from 'vitest';
import { DetectorAggregator } from '@/lib/engine/strategy/detectorAggregator';

const makeCtx = (): Record<string, unknown> => ({
  bids: [], asks: [], mid: 0, spread: 0, bestBid: 0, bestAsk: 0,
});

describe('DetectorAggregator', () => {
  beforeEach(() => { const a = new DetectorAggregator(); });

  it('should aggregate detector signals', () => {
    const r = a.run(makeCtx());
    expect(r.detector).toBe('aggregator');
    expect(r.side).toBeDefined();
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.evidence).toHaveProperty('bullScore');
    expect(r.evidence).toHaveProperty('bearScore');
  });

  it('should be neutral when no signals', () => {
    const r = a.run(makeCtx());
    expect(r.side).toBe('neutral');
    expect(r.confidence).toBe(0);
  });
});