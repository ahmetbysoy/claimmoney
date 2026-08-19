import { describe, it, expect } from 'vitest';
import { PaperExecution } from '@/lib/engine/paper-execution';
import { FeeAccounting } from '@/lib/engine/fee-accounting';
import { resetIdCounter, generateId } from '@/lib/engine/helpers';
import type { Signal, RiskConfig } from '@/lib/engine/types';

const defaultRiskConfig: RiskConfig = {
  equity: 10000,
  maxRiskPerTrade: 0.02,
  maxOpenPositions: 5,
  maxDailyLoss: 500,
  maxCorrelationExposure: 3,
  defaultStopLossATR: 1.5,
  defaultTP1R: 1,
  defaultTP2R: 2,
};

function makeExec(slippageBps = 1) {
  return new PaperExecution(new FeeAccounting(), defaultRiskConfig, slippageBps);
}

describe('PaperExecution', () => {
  it('executes a signal and creates a position', () => {
    resetIdCounter();
    const exec = makeExec();
    const state = { atr: 2, currentPrice: 100 };

    const signal: Signal = {
      id: generateId('sig'),
      ts: 1000,
      detector: 'test',
      symbol: 'BTC-USDT',
      side: 'long',
      confidence: 0.9,
      regime: 'trending_up',
      metadata: {},
    };

    const pos = exec.executeSignal(signal, state, defaultRiskConfig);
    expect(pos).not.toBeNull();
    expect(pos!.side).toBe('long');
    expect(pos!.entryPrice).toBeGreaterThan(0);
    expect(pos!.size).toBeGreaterThan(0);
    expect(exec.getOpenPositions().length).toBe(1);
  });

  it('updates position and hits stop loss', () => {
    resetIdCounter();
    const exec = makeExec();
    const state = { atr: 2, currentPrice: 100 };

    const signal: Signal = {
      id: generateId('sig'),
      ts: 1000,
      detector: 'test',
      symbol: 'BTC-USDT',
      side: 'long',
      confidence: 0.9,
      regime: 'trending_up',
      metadata: {},
    };

    const pos = exec.executeSignal(signal, state, defaultRiskConfig);
    expect(pos).not.toBeNull();
    // Update with price below stop loss
    exec.updatePosition(pos!, pos!.stopLoss - 1);
    expect(pos!.status).toBe('stopped_out');
    expect(exec.getOpenPositions().length).toBe(0);
    expect(exec.getClosedPositions().length).toBe(1);
  });

  it('tracks equity correctly', () => {
    const exec = makeExec();
    expect(exec.getEquity()).toBe(10000);
    exec.reset();
    expect(exec.getEquity()).toBe(10000);
    expect(exec.getOpenPositions().length).toBe(0);
    expect(exec.getClosedPositions().length).toBe(0);
  });
});
