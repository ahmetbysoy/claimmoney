export interface PortfolioState {
  openPositions: number;
  totalRisk: number;
  dailyPnL: number;
  maxDailyLoss: number;
  maxPositions: number;
  maxCorrelation: number;
  totalEquity: number;
  maxRiskPerTrade: number; // e.g. 0.02 = 2% of equity
  correlationExposure?: number;
}

const DEFAULTS: Omit<PortfolioState, 'openPositions' | 'dailyPnL'> = {
  totalRisk: 0,
  maxDailyLoss: 500,
  maxPositions: 3,
  maxCorrelation: 0.5,
  totalEquity: 10000,
  maxRiskPerTrade: 0.02,
  correlationExposure: 0,
};

export function createDefaultPortfolioState(equity: number): PortfolioState {
  return { ...DEFAULTS, totalEquity: equity, openPositions: 0, dailyPnL: 0 };
}

export function checkPortfolioRisk(
  state: PortfolioState,
  newSide: 'BUY' | 'SELL',
  newRiskAmount: number
): { allowed: boolean; reason?: string; adjustment?: number } {
  // Check max positions
  if (state.openPositions >= state.maxPositions) {
    return { allowed: false, reason: 'max_positions' };
  }
  // Check daily loss limit
  if (state.dailyPnL <= -state.maxDailyLoss) {
    return { allowed: false, reason: 'daily_loss_limit' };
  }
  // Check total portfolio risk (sum of all open position risks)
  const newTotalRisk = state.totalRisk + newRiskAmount;
  const maxTotalRisk = state.totalEquity * 0.1; // max 10% of equity at risk total
  if (newTotalRisk > maxTotalRisk) {
    const maxAllowed = maxTotalRisk - state.totalRisk;
    if (maxAllowed <= 0) {
      return { allowed: false, reason: 'portfolio_risk_full' };
    }
    return { allowed: true, reason: 'portfolio_risk_reduced', adjustment: maxAllowed / newRiskAmount };
  }
  // Check per-trade risk
  const maxRisk = state.totalEquity * state.maxRiskPerTrade;
  if (newRiskAmount > maxRisk) {
    return { allowed: true, reason: 'risk_capped', adjustment: maxRisk / newRiskAmount };
  }
  // Check correlation exposure (if tracked)
  if (state.correlationExposure !== undefined && state.correlationExposure > state.maxCorrelation) {
    return { allowed: false, reason: 'correlation_exceeded' };
  }
  return { allowed: true };
}