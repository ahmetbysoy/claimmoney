import { describe, it, expect, beforeEach } from 'vitest';
import { FlowExpansionDetector } from '@/lib/engine/detectors/flowExpansionDetector';
import type { DetectorContext } from '@/lib/engine/detectors/detector';

const baseCtx: DetectorContext = {
  bids: [], asks: [], mid: 100, spread: 1, bestBid: 99.5, bestAsk: 100.5,
  lastFlowDelta: 0, lastFlowVolume: 0, flowPressure: 0, vpin: 0, eventTs: Date.now(),
};

describe('FlowExpansionDetector', () => {
  let d: FlowExpansionDetector;

  beforeEach(() => { d = new FlowExpansionDetector(); });

  it('should be neutral with no flow', () => {
    const result = d.detect({ ...baseCtx, lastFlowDelta: 0, lastFlowVolume: 0 });
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect expansion', () => {
    // First call sets prevDelta
    d.detect({ ...baseCtx, lastFlowDelta: 50000, lastFlowVolume: 150000 });
    // Second call with doubled delta triggers detection
    const result = d.detect({ ...baseCtx, lastFlowDelta: 100000, lastFlowVolume: 200000 });
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
