export interface SizingResult {
  qty: number;
  notional: number;
  riskAmount: number;
  kellyFraction: number;
}

export function sizePosition(
  equity: number,
  riskFraction: number,
  entryPrice: number,
  stopPrice: number,
  winRate: number,
  avgWinLossRatio: number,
  maxPositionFraction: number
): SizingResult {
  const riskAmount = equity * riskFraction;
  const riskPerUnit = Math.abs(entryPrice - stopPrice);
  if (riskPerUnit <= 0) return { qty: 0, notional: 0, riskAmount, kellyFraction: 0 };
  const qty = riskAmount / riskPerUnit;
  const p = winRate;
  const q = 1 - p;
  const b = avgWinLossRatio;
  const kelly = b > 0 ? (p * b - q) / b : 0;
  const kellyFraction = Math.max(kelly, 0);
  const maxNotional = equity * maxPositionFraction;
  const notional = qty * entryPrice;
  const finalQty = notional > maxNotional ? maxNotional / entryPrice : qty;
  const finalNotional = finalQty * entryPrice;
  return { qty: finalQty, notional: finalNotional, riskAmount, kellyFraction };
}