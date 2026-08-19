import { describe, it, expect, beforeEach } from 'vitest';
import { TierflowRuntime } from '@/lib/engine/tierflow-runtime';
import type { MarketEvent } from '@/lib/engine/domain/events';

describe('TierflowRuntime', () => {
  let runtime: TierflowRuntime;

  beforeEach(() => {
    runtime = new TierflowRuntime({
      symbol: 'BTC-USDT-SWAP',
      equity: 10000,
      paperTrading: true,
    });
  });

  it('should initialize with correct state', () => {
    const state = runtime.getState();
    expect(state.symbol).toBe('BTC-USDT-SWAP');
    expect(state.lastPrice).toBe(0);
    expect(state.lastFrame).toBeNull();
    expect(state.lastSignal).toBeNull();
  });

  it('should process book snapshot and build frame', () => {
    const snapshot: MarketEvent = {
      kind: 'bookSnapshot',
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      eventTs: 1000,
      receiveTs: 1100,
      seq: 1,
      bids: [
        { price: 100, qty: 10 },
        { price: 99, qty: 20 },
        { price: 98, qty: 15 },
      ],
      asks: [
        { price: 101, qty: 10 },
        { price: 102, qty: 20 },
        { price: 103, qty: 15 },
      ],
    };
    runtime.onEvent(snapshot);
    const state = runtime.getState();
    expect(state.lastFrame).not.toBeNull();
    expect(state.lastFrame!.symbol).toBe('BTC-USDT-SWAP');
  });

  it('should process trades and update features', () => {
    // First, set up book for context
    runtime.onEvent({
      kind: 'bookSnapshot', exchange: 'okx', symbol: 'BTC-USDT-SWAP',
      eventTs: 1000, receiveTs: 1100, seq: 1,
      bids: [{ price: 100, qty: 10 }], asks: [{ price: 101, qty: 10 }],
    });
    // Feed trades with buy bias
    for (let i = 0; i < 25; i++) {
      runtime.onEvent({
        kind: 'trade', exchange: 'okx', symbol: 'BTC-USDT-SWAP',
        eventTs: 2000 + i * 100, receiveTs: 2100 + i * 100,
        tradeId: `t${i}`, price: 100.5, qty: i % 3 === 0 ? 1 : 10,
        aggressor: 'buy',
      });
    }
    const state = runtime.getState();
    expect(state.lastPrice).toBe(100.5);
  });

  it('should not fire signal when filters veto', () => {
    // Very flat market — low volatility should trigger flat_market veto
    runtime.onEvent({
      kind: 'bookSnapshot', exchange: 'okx', symbol: 'BTC-USDT-SWAP',
      eventTs: 1000, receiveTs: 1100, seq: 1,
      bids: [{ price: 100.0001, qty: 10 }], asks: [{ price: 100.0002, qty: 10 }],
    });
    const state = runtime.getState();
    // Even if score is high, filter should veto
    expect(state.lastSignal).toBeNull();
  });

  it('should reset cleanly', () => {
    runtime.onEvent({
      kind: 'bookSnapshot', exchange: 'okx', symbol: 'BTC-USDT-SWAP',
      eventTs: 1000, receiveTs: 1100, seq: 1,
      bids: [{ price: 100, qty: 10 }], asks: [{ price: 101, qty: 10 }],
    });
    runtime.reset();
    const state = runtime.getState();
    expect(state.lastFrame).toBeNull();
    expect(state.lastScore).toBe(0);
  });
});
