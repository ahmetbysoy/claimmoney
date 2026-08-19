import { describe, it, expect } from 'vitest';
import { LiquidationClusterDetector } from '@/lib/engine/detectors/liquidationClusterDetector';

describe('LiquidationClusterDetector', () => {
  beforeEach(() => { const d = new LiquidationClusterDetector(); });
  it('should be neutral', () => {
    const ctx = { bids: [], asks: [], mid: 0 };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });
});