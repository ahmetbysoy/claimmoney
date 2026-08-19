import { describe, it, expect } from 'vitest';
import { runFilters } from '@/lib/engine/strategy/filters';
import type { FeatureFrame } from '@/lib/engine/domain/frames';

function makeFrame(overrides?: Partial<FeatureFrame>): FeatureFrame {
  return {
    id: 'test',
    symbol: 'BTC-USDT',
    eventTs: Date.now(),
    dataQuality: 'good',
    cvdZ: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    obi: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    velocityZ: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    microDev: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    vpin: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    detectorScore: { value: 0, valid: false, warmup: 0, ageMs: 0 },
    volatility: { value: 0.01, valid: true, warmup: 10, ageMs: 0 },
    ...overrides,
  };
}

describe('runFilters', () => {
  it('should pass when all features are good', () => {
    const frame = makeFrame();
    const result = runFilters(frame);
    expect(result.passed).toBe(true);
    expect(result.decisions).toHaveLength(0);
  });

  it('should veto on flat market', () => {
    const frame = makeFrame({
      volatility: { value: 0.0001, valid: true, warmup: 10, ageMs: 0 },
    });
    const result = runFilters(frame, { flatThreshold: 0.0005 });
    expect(result.passed).toBe(false);
    expect(result.decisions.some(d => d.id === 'flat_market')).toBe(true);
  });

  it('should veto on low OBI', () => {
    const frame = makeFrame({
      obi: { value: 0.01, valid: true, warmup: 10, ageMs: 0 },
    });
    const result = runFilters(frame, { minOBI: 0.06 });
    expect(result.passed).toBe(false);
    expect(result.decisions.some(d => d.id === 'obi_confluence')).toBe(true);
  });

  it('should veto on high VPIN', () => {
    const frame = makeFrame({
      vpin: { value: 0.9, valid: true, warmup: 10, ageMs: 0 },
    });
    const result = runFilters(frame, { vpinVeto: 0.8 });
    expect(result.passed).toBe(false);
    expect(result.decisions.some(d => d.id === 'vpin_veto')).toBe(true);
  });

  it('should veto on invalid data quality', () => {
    const frame = makeFrame({ dataQuality: 'invalid' });
    const result = runFilters(frame);
    expect(result.passed).toBe(false);
    expect(result.decisions.some(d => d.id === 'data_quality')).toBe(true);
  });
});
