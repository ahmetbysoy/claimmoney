import { describe, it, expect } from 'vitest';
import { QuoteManipulationDetector } from '@/lib/engine/detectors/quoteManipulationDetector';

describe('QuoteManipulationDetector', () => {
  beforeEach(() => { const d = new QuoteManipulationDetector(); });
  it('should be neutral', () => {
    const ctx = { bids: [], asks: [], mid: 0, spread: 0 };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });
});
