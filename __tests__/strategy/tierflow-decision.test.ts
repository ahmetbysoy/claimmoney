import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionFSM } from '@/lib/engine/strategy/decisionMachine';

describe('DecisionFSM', () => {
  let fsm: DecisionFSM;

  beforeEach(() => {
    fsm = new DecisionFSM({ threshold: 0.35, cooldownMs: 100, minDwellMs: 50 });
  });

  it('should start in IDLE state', () => {
    const { state } = fsm.getState();
    expect(state).toBe('IDLE');
  });

  it('should not fire when score is below threshold', () => {
    const result = fsm.tick(0.1, Date.now());
    expect(result.fired).toBe(false);
    expect(result.side).toBeNull();
  });

  it('should fire BUY after threshold + minDwell', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    const result = fsm.tick(0.5, now + 100);
    expect(result.fired).toBe(true);
    expect(result.side).toBe('BUY');
  });

  it('should fire SELL for negative score', () => {
    const now = Date.now();
    fsm.tick(-0.5, now);
    const result = fsm.tick(-0.5, now + 100);
    expect(result.fired).toBe(true);
    expect(result.side).toBe('SELL');
  });

  it('should enter cooldown after firing', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    fsm.tick(0.5, now + 100);
    fsm.tick(0, now + 150);
    const { state } = fsm.getState();
    expect(state).toBe('COOLDOWN');
  });

  it('should not fire during cooldown', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    fsm.tick(0.5, now + 100);
    const result = fsm.tick(0.5, now + 150);
    expect(result.fired).toBe(false);
  });

  it('should reset back to IDLE after cooldown expires', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    fsm.tick(0.5, now + 100);
    fsm.tick(0.5, now + 150);
    fsm.tick(0, now + 300);
    const { state } = fsm.getState();
    expect(state).toBe('IDLE');
  });

  it('should reset state cleanly', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    fsm.reset();
    const { state, consecutiveCount, lastSide } = fsm.getState();
    expect(state).toBe('IDLE');
    expect(consecutiveCount).toBe(0);
    expect(lastSide).toBeNull();
  });

  it('should revert to IDLE if side flips while armed', () => {
    const now = Date.now();
    fsm.tick(0.5, now);
    fsm.tick(-0.5, now + 10);
    const { state } = fsm.getState();
    expect(state).toBe('IDLE');
  });
});
