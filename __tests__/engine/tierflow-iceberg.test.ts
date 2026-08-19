import { describe, it, expect } from 'vitest';
import { IcebergDetector } from '@/lib/engine/detectors/icebergDetector';

describe('IcebergDetector', () => {
  beforeEach(() => { const d = new IcebergDetector(); });

  it('should be neutral with no volume', () => {
    const ctx = { bids: [], asks: [], mid: 0, lastFlowDelta: 0, lastFlowVolume: 0 };
    const result = d.detect(ctx);
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect iceberg with high ratio', () => {
    const ctx = { bids: [{ price: 100, qty: 100 }], asks: [{ price: 100, qty: 100 }], mid: 100, lastFlowVolume: 400, lastFlowDelta: 0 };
    const result = d.detect(ctx);
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
