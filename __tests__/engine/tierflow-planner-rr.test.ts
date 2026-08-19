import { describe, it, expect } from 'vitest';
import { createTradePlan } from '@/lib/engine/risk/tradePlanner';

describe('TradePlanner RR fix', () => {
  it('should use tp2R as the R:R ratio', () => {
    const plan = createTradePlan('BUY', 100, 0.5, null, 1, 1.5, 2.5, 2.0)!;
    // risk = stopDistance, reward = risk * 2.5, rr = 2.5
    expect(plan.riskReward).toBe(2.5);
  });

  it('should reject if rr < minRR', () => {
    const plan = createTradePlan('BUY', 100, 0.5, null, 1, 1.5, 1.8, 2.0);
    expect(plan).toBeNull();
  });

  it('should calculate TP levels correctly', () => {
    const plan = createTradePlan('BUY', 100, 0.5, null, 1, 1.5, 2.5, 2.0)!;
    const risk = Math.abs(plan.entryPrice - plan.stopLoss);
    expect(plan.takeProfit1).toBeCloseTo(plan.entryPrice + risk * 1.5, 2);
    expect(plan.takeProfit2).toBeCloseTo(plan.entryPrice + risk * 2.5, 2);
  });

  it('should handle SELL side correctly', () => {
    const plan = createTradePlan('SELL', 100, 0.5, null, 1, 1.5, 2.5, 2.0)!;
    expect(plan.stopLoss).toBeGreaterThan(plan.entryPrice);
    expect(plan.takeProfit1).toBeLessThan(plan.entryPrice);
    expect(plan.takeProfit2).toBeLessThan(plan.takeProfit1);
  });
});
