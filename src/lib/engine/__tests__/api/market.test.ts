import { describe, it, expect } from 'vitest';
import { MarketRuntime } from '@/lib/engine/market-runtime';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

describe('Market API', () => {
  it('GET market state returns current state', () => {
    const rt = new MarketRuntime();
    rt.processCandle(makeCandle(1000, 100, 105, 95, 102, 1000));
    const state = rt.getState();
    expect(state.currentPrice).toBe(102);
    expect(state.candleCount).toBe(1);
    // Equivalent to GET /api/market/state
    const response = { success: true, data: state };
    expect(response.success).toBe(true);
  });

  it('POST process candle updates state', () => {
    const rt = new MarketRuntime();
    const candle = makeCandle(1000, 100, 105, 95, 102, 1000);
    rt.processCandle(candle);
    // Equivalent to POST /api/market/process
    const stats = rt.getStatistics();
    expect(stats.candles).toBe(1);
    expect(stats.open).toBe(100);
    expect(stats.close).toBe(102);
  });
});
