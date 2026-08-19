import { describe, it, expect } from 'vitest';
import { MarketRuntime } from '@/lib/engine/market-runtime';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, o: number, h: number, l: number, c: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

describe('MarketRuntime', () => {
  it('processes a candle and updates state', () => {
    const rt = new MarketRuntime();
    rt.processCandle(makeCandle(1000, 100, 105, 95, 102, 1000));
    const state = rt.getState();
    expect(state.currentPrice).toBe(102);
    expect(state.candleCount).toBe(1);
    expect(state.high).toBe(105);
    expect(state.low).toBe(95);
    expect(state.volume).toBe(1000);
  });

  it('returns correct state after multiple candles', () => {
    const rt = new MarketRuntime();
    rt.processCandle(makeCandle(1000, 100, 105, 95, 102, 1000));
    rt.processCandle(makeCandle(2000, 102, 108, 101, 107, 2000));
    rt.processCandle(makeCandle(3000, 107, 110, 106, 109, 1500));
    const state = rt.getState();
    expect(state.currentPrice).toBe(109);
    expect(state.previousPrice).toBe(107);
    expect(state.candleCount).toBe(3);
    expect(state.high).toBe(110);
    expect(state.low).toBe(95);
  });

  it('resets all state cleanly', () => {
    const rt = new MarketRuntime();
    rt.processCandle(makeCandle(1000, 100, 105, 95, 102, 1000));
    rt.reset();
    const state = rt.getState();
    expect(state.currentPrice).toBe(0);
    expect(state.candleCount).toBe(0);
    expect(state.high).toBe(0);
    expect(state.low).toBe(0);
    expect(state.volume).toBe(0);
  });
});
