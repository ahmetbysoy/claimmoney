import { describe, it, expect } from 'vitest';
import { FeeAccounting } from '@/lib/engine/fee-accounting';

describe('FeeAccounting', () => {
  it('calculates maker and taker fees', () => {
    const fa = new FeeAccounting(0.0002, 0.0005);
    const makerFee = fa.calculateFee(10, 100, true);
    const takerFee = fa.calculateFee(10, 100, false);
    // maker: 10 * 100 * 0.0002 = 0.2
    expect(makerFee).toBe(0.2);
    // taker: 10 * 100 * 0.0005 = 0.5
    expect(takerFee).toBe(0.5);
  });

  it('calculates slippage cost', () => {
    const fa = new FeeAccounting();
    const slippage = fa.calculateSlippage(100, 'long', 5);
    // 100 * 5/10000 = 0.05
    expect(slippage).toBe(0.05);
  });

  it('calculates R-multiple', () => {
    const fa = new FeeAccounting();
    expect(fa.calculateRMultiple(200, 100)).toBe(2);
    expect(fa.calculateRMultiple(-50, 100)).toBe(-0.5);
    expect(fa.calculateRMultiple(100, 0)).toBe(0); // no risk
  });
});
