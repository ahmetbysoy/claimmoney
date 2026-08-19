import { describe, it, expect } from 'vitest';
import { SignalPipeline } from '@/lib/engine/signal-pipeline';
import { resetIdCounter, generateId } from '@/lib/engine/helpers';
import type { Signal } from '@/lib/engine/types';

function makeSignal(ts: number, regime: string, detector: string, side: 'long' | 'short' = 'long'): Signal {
  return {
    id: generateId('sig'),
    ts,
    detector,
    symbol: 'BTC-USDT',
    side,
    confidence: 0.8,
    regime: regime as Signal['regime'],
    metadata: {},
  };
}

describe('SignalPipeline', () => {
  it('processes signals through built-in filters', () => {
    resetIdCounter();
    const pipeline = new SignalPipeline();
    const state = { allowedRegimes: ['trending_up', 'ranging'] };
    const signals = [
      makeSignal(1000, 'trending_up', 'test'),
      makeSignal(2000, 'volatile', 'test2'),
    ];
    const results = pipeline.process(signals, state);
    expect(results.length).toBe(2);
    // First signal: trending_up is in allowed regimes, but cooldown_filter may reject
    // Second signal: volatile not in allowed regimes -> rejected by regime_filter
    expect(results[1].passed).toBe(false);
    expect(results[1].filterReason).toContain('regime_filter');
  });

  it('adds and uses a custom filter', () => {
    resetIdCounter();
    const pipeline = new SignalPipeline();
    pipeline.removeFilter('regime_filter');
    pipeline.removeFilter('correlation_filter');
    pipeline.removeFilter('max_positions_filter');
    pipeline.removeFilter('cooldown_filter');
    pipeline.addFilter('min_confidence', (signal) => signal.confidence >= 0.9);
    const signals = [
      makeSignal(1000, 'trending_up', 'test'), // confidence 0.8
    ];
    (signals[0] as Signal).confidence = 0.8;
    const results = pipeline.process(signals, {});
    expect(results[0].passed).toBe(false);
    expect(results[0].filterReason).toContain('min_confidence');
  });

  it('tracks filter statistics', () => {
    resetIdCounter();
    const pipeline = new SignalPipeline();
    const state = { allowedRegimes: ['trending_up'] };
    const signals = [
      makeSignal(1000, 'trending_up', 'a'),
      makeSignal(2000, 'ranging', 'b'),
      makeSignal(3000, 'trending_up', 'c'),
    ];
    pipeline.process(signals, state);
    const stats = pipeline.getFilterStats();
    expect(stats.length).toBeGreaterThan(0);
    // regime_filter should have at least 1 rejection
    const regimeStats = stats.find((s) => s.name === 'regime_filter');
    expect(regimeStats?.rejected).toBeGreaterThanOrEqual(1);
  });
});
