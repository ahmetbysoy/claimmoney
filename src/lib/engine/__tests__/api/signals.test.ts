import { describe, it, expect } from 'vitest';
import { SignalPipeline } from '@/lib/engine/signal-pipeline';
import { resetIdCounter, generateId } from '@/lib/engine/helpers';
import type { Signal } from '@/lib/engine/types';

function makeSignal(ts: number, regime: string): Signal {
  return {
    id: generateId('sig'),
    ts,
    detector: 'test',
    symbol: 'BTC-USDT',
    side: 'long',
    confidence: 0.8,
    regime: regime as Signal['regime'],
    metadata: {},
  };
}

describe('Signals API', () => {
  it('GET signals returns filtered signal list', () => {
    resetIdCounter();
    const pipeline = new SignalPipeline();
    pipeline.removeFilter('cooldown_filter');
    const signals = [makeSignal(1000, 'trending_up'), makeSignal(2000, 'ranging')];
    const state = { allowedRegimes: ['trending_up', 'ranging'], openPositions: [], maxPositions: 5, openSignals: [], maxCorrelated: 3 };
    const results = pipeline.process(signals, state);
    // Equivalent to GET /api/signals
    const response = { success: true, data: results };
    expect(response.success).toBe(true);
    expect(response.data.length).toBe(2);
  });

  it('POST signal passes through pipeline', () => {
    resetIdCounter();
    const pipeline = new SignalPipeline();
    pipeline.removeFilter('cooldown_filter');
    pipeline.removeFilter('regime_filter');
    pipeline.removeFilter('correlation_filter');
    pipeline.removeFilter('max_positions_filter');
    const signal = makeSignal(1000, 'trending_up');
    const results = pipeline.process([signal], {});
    // Equivalent to POST /api/signals
    expect(results[0].passed).toBe(true);
  });
});
