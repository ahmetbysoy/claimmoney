import { describe, it, expect, beforeEach } from 'vitest';
import { CVDFeature } from '@/lib/engine/features/cvdFeature';

describe('CVDFeature z-score', () => {
  let cvd: CVDFeature;
  beforeEach(() => { cvd = new CVDFeature(); });

  it('should produce non-zero z-score after warmup', () => {
    // Feed 30 trades with buy bias
    for (let i = 0; i < 30; i++) {
      cvd.onTrade(`t${i}`, 'buy', 100, 1000 + i * 100);
      cvd.onTrade(`s${i}`, 'sell', 50, 1050 + i * 100);
    }
    const val = cvd.getValue(5000);
    expect(val.valid).toBe(true);
    // With buy bias, z should be positive (buy pressure)
    expect(val.value).not.toBe(0);
    expect(val.evidence?.emaStd).toBeGreaterThan(0);
  });

  it('should track emaMean and emaStd over time', () => {
    const vals: number[] = [];
    for (let i = 0; i < 60; i++) {
      const side = i % 3 === 0 ? 'sell' : 'buy';
      cvd.onTrade(`t${i}`, side, 100, 1000 + i * 100);
    }
    const val = cvd.getValue(10000);
    expect(val.valid).toBe(true);
    expect(val.evidence?.emaMean).toBeDefined();
    expect(val.evidence?.emaStd).toBeGreaterThan(0);
    vals.push(val.value);
  });

  it('should return invalid when insufficient data', () => {
    for (let i = 0; i < 5; i++) {
      cvd.onTrade(`t${i}`, 'buy', 10, 1000 + i * 100);
    }
    const val = cvd.getValue(2000);
    expect(val.valid).toBe(false);
  });

  it('should deduplicate trades by id', () => {
    for (let i = 0; i < 10; i++) {
      cvd.onTrade('same', 'buy', 100, 1000 + i * 100);
    }
    const val = cvd.getValue(2000);
    // Only 1 unique trade counted
    expect(val.warmup).toBe(1);
    expect(val.valid).toBe(false);
  });

  it('should reset cleanly', () => {
    for (let i = 0; i < 30; i++) {
      cvd.onTrade(`t${i}`, 'buy', 100, 1000 + i * 100);
    }
    cvd.reset();
    const val = cvd.getValue(10000);
    expect(val.valid).toBe(false);
    expect(val.value).toBe(0);
  });
});
