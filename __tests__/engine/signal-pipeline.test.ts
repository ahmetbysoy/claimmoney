import { describe, it, expect } from 'vitest';
import { SignalPipeline } from '@/lib/engine/signal-pipeline';
import type { Signal } from '@/lib/engine/types';

const makeSignal = (ts: number, regime: 'trending_up' | 'ranging' = 'trending_up', confidence = 0.8): Signal => ({
  id: 's1', ts, detector: 'test', symbol: 'BTC', side: 'long',
  confidence, regime, metadata: {},
});

describe('SignalPipeline', () => {
  it('should pass valid signals through all filters', () => {
    const pipeline = new SignalPipeline();
    const results = pipeline.process([makeSignal(200000)], {
      allowedRegimes: ['trending_up'],
      openPositions: [],
      maxPositions: 5,
      lastSignalTs: 0,
      cooldownMs: 60000,
      minConfidence: 0.5,
    });
    expect(results.length).toBe(1);
    expect(results[0].passed).toBe(true);
  });

  it('should support adding custom filters', () => {
    const pipeline = new SignalPipeline();
    pipeline.addFilter('custom_confidence', (signal) => signal.confidence > 0.9);
    const results = pipeline.process([makeSignal(200000)], { allowedRegimes: ['trending_up'], openPositions: [], maxPositions: 5, lastSignalTs: 0, cooldownMs: 60000, minConfidence: 0.5 });
    expect(results[0].passed).toBe(false);
    expect(results[0].filterReason).toBe('custom_confidence');
  });

  it('should track filter statistics', () => {
    const pipeline = new SignalPipeline();
    pipeline.process([makeSignal(200000, 'ranging')], { allowedRegimes: ['trending_up'], openPositions: [], maxPositions: 5, lastSignalTs: 0, cooldownMs: 60000, minConfidence: 0.5 });
    const stats = pipeline.getFilterStats();
    expect(stats.length).toBeGreaterThan(0);
    const regimeFilter = stats.find(s => s.name === 'regime_filter');
    expect(regimeFilter?.rejected).toBe(1);
  });
});
