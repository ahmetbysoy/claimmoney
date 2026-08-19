import { describe, it, expect } from 'vitest';
import { computeCompositeScore, normalizeWeights } from '@/lib/engine/strategy/scoreModel';
import type { FeatureFrame } from '@/lib/engine/domain/frames';

function makeFrame(overrides: Partial<FeatureFrame>): FeatureFrame {
  const inv = () => ({ value: 0, valid: false, warmup: Infinity, ageMs: Infinity });
  return { id: 'test', symbol: 'BTC', eventTs: 1000, dataQuality: 'good', cvdZ: inv(), obi: inv(), velocityZ: inv(), microDev: inv(), vpin: inv(), detectorScore: inv(), volatility: inv(), ...overrides };
}

describe('ScoreModel', () => {
  it('should score zero for invalid frame', () => {
    const frame = makeFrame({ dataQuality: 'invalid' });
    const score = computeCompositeScore(frame);
    expect(score).toBe(0);
  });

  it('should score bullish frame', () => {
    const frame = makeFrame({ dataQuality: 'good',
      cvdZ: { value: 1.5, valid: true, warmup: 30, ageMs: 0 },
      obi: { value: -0.3, valid: true, warmup: 10, ageMs: 0 },
      velocityZ: { value: 2.1, valid: true, warmup: 30, ageMs: 0 },
      microDev: { value: -0.5, valid: true, warmup: 10, ageMs: 0 },
      vpin: { value: 0.1, valid: true, warmup: 20, ageMs: 0 },
      detectorScore: { value: 0.8, valid: true, warmup: 5, ageMs: 0 },
    });
    const score = computeCompositeScore(frame);
    expect(score).toBeGreaterThan(0);
  });

  it('should clamp score', () => {
    const frame2 = makeFrame({ dataQuality: 'good',
      cvdZ: { value: 10, valid: true, warmup: 60, ageMs: 0 },
      obi: { value: -10, valid: true, warmup: 10, ageMs: 0 },
      velocityZ: { value: 5, valid: true, warmup: 30, ageMs: 0 },
      microDev: { value: -5, valid: true, warmup: 10, ageMs: 0 },
    });
    const score = computeCompositeScore(frame2);
    expect(score).toBeLessThan(1.01);
    expect(score).toBeGreaterThan(-1);
  });
});
