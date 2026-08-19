import { describe, it, expect } from 'vitest';
import { DetectorRegistry } from '@/lib/engine/detector-registry';

describe('DetectorRegistry', () => {
  it('registers and retrieves all built-in detectors', () => {
    const reg = new DetectorRegistry();
    const detectors = reg.getDetectors();
    expect(detectors.length).toBeGreaterThanOrEqual(4);
    const names = detectors.map((d) => d.name);
    expect(names).toContain('mean_reversion');
    expect(names).toContain('momentum');
    expect(names).toContain('breakout');
    expect(names).toContain('volume_spike');
  });

  it('runs all enabled detectors on a state', () => {
    const reg = new DetectorRegistry();
    const state = {
      currentPrice: 110,
      sma20: 100,
      atr: 5,
      volume_ratio: 3,
      ema9: 108,
      ema21: 102,
    };
    const results = reg.runAll(state);
    expect(results.length).toBeGreaterThanOrEqual(2); // mean_reversion and volume_spike should fire
    const allSignals = results.flatMap((r) => r.signals);
    expect(allSignals.length).toBeGreaterThanOrEqual(2);
  });

  it('enables and disables detectors', () => {
    const reg = new DetectorRegistry();
    reg.disable('mean_reversion');
    const state = { currentPrice: 80, sma20: 100, atr: 5 };
    const results = reg.runAll(state);
    const mrResult = results.find((r) => r.detector === 'mean_reversion');
    // When disabled, it should not appear in results
    expect(mrResult).toBeUndefined();

    reg.enable('mean_reversion');
    const results2 = reg.runAll(state);
    const mrResult2 = results2.find((r) => r.detector === 'mean_reversion');
    expect(mrResult2).toBeDefined();
  });
});
