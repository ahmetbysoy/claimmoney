import { describe, it, expect } from 'vitest';
import { LadderDetector } from '@/lib/engine/detectors/ladderDetector';

describe('LadderDetector', () => {
  beforeEach(() => { const d = new LadderDetector(); });

  it('should detect bid ladder', () => {
    const result = d.detect({ bids: [{ price: 100, qty: 5000 }, { price: 101, qty: 4000 }, { price: 102, qty: 3000 }], asks: [] });
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect ask ladder', () => {
    const result = d.detect({ bids: [], asks: [{ price: 100, qty: 5000 }, { price: 99, qty: 4000 }, { price: 97, qty: 3000 }], mid: 100 });
    expect(result.side).toBe('bearish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
