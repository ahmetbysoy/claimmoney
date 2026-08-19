export interface TradePlan {
  side: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  minRR: number;
}

export function createTradePlan(
  side: 'BUY' | 'SELL',
  entryPrice: number,
  spread: number,
  wallLevel: number | null,
  slippageBps: number,
  tp1R: number,
  tp2R: number,
  minRR: number
): TradePlan | null {
  const slippage = entryPrice * (slippageBps / 10000);
  const adjustedEntry = side === 'BUY' ? entryPrice + slippage : entryPrice - slippage;
  let stopDistance: number;
  if (wallLevel !== null && wallLevel > 0) {
    stopDistance = Math.abs(entryPrice - wallLevel) + spread;
  } else {
    stopDistance = spread * 3;
  }
  const stopLoss = side === 'BUY'
    ? adjustedEntry - stopDistance
    : adjustedEntry + stopDistance;
  const risk = Math.abs(adjustedEntry - stopLoss);
  if (risk <= 0) return null;
  const reward = risk * tp2R;
  const rr = reward / risk; // tp2R is the actual R:R ratio
  if (rr < minRR) return null;
  const takeProfit1 = side === 'BUY'
    ? adjustedEntry + risk * tp1R
    : adjustedEntry - risk * tp1R;
  const takeProfit2 = side === 'BUY'
    ? adjustedEntry + risk * tp2R
    : adjustedEntry - risk * tp2R;
  return { side, entryPrice: adjustedEntry, stopLoss, takeProfit1, takeProfit2, riskReward: rr, minRR };
}