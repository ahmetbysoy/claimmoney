export interface PortfolioState {
  openPositions: number;
  totalRisk: number;
  dailyPnL: number;
  maxDailyLoss: number;
  maxPositions: number;
  maxCorrelation: number;
}

export function checkPortfolioRisk(
  state: PortfolioState,
  newSide: 'BUY' | 'SELL',
  newRiskAmount: number
): { allowed: boolean; reason?: string } {
  if (state.openPositions >= state.maxPositions) {
    return { allowed: false, reason: 'Max positions reached' };
  }
  if (state.dailyPnL <= -state.maxDailyLoss) {
    return { allowed: false, reason: 'Max daily loss reached' };
  }
  return { allowed: true };
}