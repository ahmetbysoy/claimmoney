import { describe, it, expect, beforeEach } from 'vitest';
import { PaperBroker } from '@/lib/engine/execution/paperBroker';
import { createTradePlan } from '@/lib/engine/risk/tradePlanner';
import type { SizingResult } from '@/lib/engine/risk/positionSizer';

describe('PaperBroker partial exit', () => {
  let broker: PaperBroker;
  const plan = createTradePlan('BUY', 100, 0.5, null, 1, 1.5, 2.5, 2.0)!;
  const sizing: SizingResult = { qty: 10, notional: 1000, riskAmount: 20, kellyFraction: 0.02 };

  beforeEach(() => { broker = new PaperBroker(10000); });

  it('should fill pending order on first update', () => {
    const order = broker.submitOrder(plan, sizing, 1000);
    expect(order.status).toBe('pending');
    broker.updateOrder(order.id, 100.5, 1100);
    expect(order.status).toBe('filled');
    expect(order.filledQty).toBe(10);
    expect(order.totalFees).toBeGreaterThan(0);
  });

  it('should partial close 50% at TP1 and move SL to breakeven', () => {
    const order = broker.submitOrder(plan, sizing, 1000);
    broker.updateOrder(order.id, 100, 1100); // fill
    // TP1 = entry + risk * 1.5R = 100.5 + (100.5-97.5)*1.5 ≈ 105
    broker.updateOrder(order.id, plan.takeProfit1 + 0.1, 1200); // hit TP1
    expect(order.status).toBe('tp1_hit');
    expect(order.tp1ExitQty).toBe(5); // 50% of 10
    expect(order.remainingQty).toBe(5);
    expect(order.plan.stopLoss).toBe(plan.entryPrice); // moved to breakeven
  });

  it('should close remaining at TP2', () => {
    const order = broker.submitOrder(plan, sizing, 1000);
    broker.updateOrder(order.id, 100, 1100);
    broker.updateOrder(order.id, plan.takeProfit1 + 0.1, 1200); // TP1
    broker.updateOrder(order.id, plan.takeProfit2 + 0.1, 1300); // TP2
    expect(order.status).toBe('tp2_hit');
    expect(order.tp2ExitQty).toBe(5);
    expect(order.remainingQty).toBe(0);
    expect(order.exitTs).toBeDefined();
    expect(order.pnl).toBeGreaterThan(0);
  });

  it('should stop out at SL', () => {
    const order = broker.submitOrder(plan, sizing, 1000);
    broker.updateOrder(order.id, 100, 1100);
    broker.updateOrder(order.id, plan.stopLoss - 0.1, 1200); // hit SL
    expect(order.status).toBe('stopped_out');
    expect(order.remainingQty).toBe(0);
    expect(order.slExitPrice).toBe(plan.stopLoss);
    expect(order.pnl).toBeLessThan(0);
  });

  it('should track equity including closed PnL', () => {
    const order = broker.submitOrder(plan, sizing, 1000);
    broker.updateOrder(order.id, 100, 1100);
    broker.updateOrder(order.id, plan.takeProfit2 + 1, 1200);
    const eq = broker.getEquity();
    expect(eq).toBeGreaterThan(10000); // profit
  });

  it('should handle SELL side partial exit', () => {
    const sellPlan = createTradePlan('SELL', 100, 0.5, null, 1, 1.5, 2.5, 2.0)!;
    const order = broker.submitOrder(sellPlan, sizing, 1000);
    broker.updateOrder(order.id, 100, 1100);
    broker.updateOrder(order.id, sellPlan.takeProfit1 - 0.1, 1200); // TP1 for sell
    expect(order.status).toBe('tp1_hit');
    expect(order.tp1ExitQty).toBe(5);
  });
});
