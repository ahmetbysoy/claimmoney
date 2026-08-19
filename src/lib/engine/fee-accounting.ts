import type { SignalSide } from './types';

export class FeeAccounting {
  private makerFeeRate: number;
  private takerFeeRate: number;

  constructor(makerRate = 0.0002, takerRate = 0.0005) {
    this.makerFeeRate = makerRate;
    this.takerFeeRate = takerRate;
  }

  calculateFee(size: number, price: number, isMaker: boolean): number {
    const rate = isMaker ? this.makerFeeRate : this.takerFeeRate;
    return size * price * rate;
  }

  calculateSlippage(
    price: number,
    side: SignalSide,
    slippageBps: number
  ): number {
    const slip = price * (slippageBps / 10000);
    return side === 'buy' ? slip : -slip;
  }

  calculateTotalCost(
    entryFee: number,
    exitFee: number,
    slippageCost: number
  ): number {
    return entryFee + exitFee + Math.abs(slippageCost);
  }

  calculateRMultiple(pnl: number, riskAmount: number): number {
    if (riskAmount === 0) return 0;
    return pnl / riskAmount;
  }

  calculateBreakevenPrice(
    entryPrice: number,
    totalFee: number,
    size: number,
    side: SignalSide
  ): number {
    if (size === 0) return entryPrice;
    const feePerUnit = totalFee / size;
    return side === 'long'
      ? entryPrice + feePerUnit
      : entryPrice - feePerUnit;
  }
}
