import { describe, it, expect } from 'vitest';
import { FeeAccounting } from '@/lib/engine/fee-accounting';

describe('FeeAccounting', () => {
  it('should calculate maker fee', () => {
    const fa = new FeeAccounting();
    const fee = fa.calculateFee(10, 100, true);
    expect(fee).toBe(0.2); // 10 * 100 * 0.0002
  });

  it('should calculate taker fee', () => {
    const fa = new FeeAccounting();
    const fee = fa.calculateFee(10, 100, false);
    expect(fee).toBe(0.5); // 10 * 100 * 0.0005
  });

  it('should calculate R-multiple', () => {
    const fa = new FeeAccounting();
    expect(fa.calculateRMultiple(200, 100)).toBe(2);
    expect(fa.calculateRMultiple(-50, 100)).toBe(-0.5);
  });
});
