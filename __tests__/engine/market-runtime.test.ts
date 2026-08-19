import { describe, it, expect, beforeEach } from 'vitest';
import { MarketRuntime } from '@/lib/engine/market-runtime';
import type { Candle } from '@/lib/engine/types';

describe('MarketRuntime', () => {
  let runtime: MarketRuntime;

  beforeEach(() => {
    runtime = new MarketRuntime();
  });

  it('should process candle and update state', () => {
    const candle: Candle = { ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 };
    runtime.processCandle(candle);
    const state = runtime.getState();
    expect(state.currentPrice).toBe(103);
    expect(state.candleCount).toBe(1);
    expect(state.lastCandle).toEqual(candle);
  });

  it('should return correct statistics', () => {
    for (let i = 0; i < 5; i++) {
      runtime.processCandle({ ts: 1000 + i * 60000, o: 100 + i, h: 105 + i, l: 98 + i, c: 103 + i, v: 500 });
    }
    const stats = runtime.getStatistics();
    expect(stats.candles).toBe(5);
    expect(stats.open).toBe(100);
    expect(stats.close).toBe(107);
    expect(stats.volume).toBe(2500);
  });

  it('should reset state completely', () => {
    runtime.processCandle({ ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 });
    runtime.reset();
    const state = runtime.getState();
    expect(state.currentPrice).toBe(0);
    expect(state.candleCount).toBe(0);
    expect(state.allCandles).toEqual([]);
  });
});
