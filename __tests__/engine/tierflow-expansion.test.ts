import { describe, it, expect } from 'vitest';
import { FlowExpansionDetector } from '@/lib/engine/detectors/flowExpansionDetector';

describe('FlowExpansionDetector', () => {
  beforeEach(() => { const d = new FlowExpansionDetector(); });
  it('should be neutral with no flow', () => {
    const result = d.detect({ lastFlowDelta: 0, lastFlowVolume: 0 });
    expect(result.side).toBe('neutral');
    expect(result.confidence).toBe(0);
  });

  it('should detect expansion', () => {
    const result = d.detect({ lastFlowDelta: 100000, lastFlowVolume: 200000 });
    expect(result.side).toBe('bullish');
    expect(result.confidence).toBeGreaterThan(0);
  });
});
