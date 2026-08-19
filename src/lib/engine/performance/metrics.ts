// ClaimMoney v3 — Trading Performance Metrics
// Pure static utility methods. All handle edge cases gracefully.

export interface TradeRecord {
  entryTs: number;
  exitTs: number;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  qty: number;
  fees: number;
  pnl: number;
  rMultiple: number;
}

export class Metrics {
  /** Fraction of trades with positive PnL. Returns 0 for empty input. */
  static winRate(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;
    let wins = 0;
    for (const t of trades) {
      if (t.pnl > 0) wins++;
    }
    return wins / trades.length;
  }

  /** Gross profit / gross loss. Returns 0 if no losses (or empty). */
  static profitFactor(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;
    let grossProfit = 0;
    let grossLoss = 0;
    for (const t of trades) {
      if (t.pnl > 0) grossProfit += t.pnl;
      else grossLoss += Math.abs(t.pnl);
    }
    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    return grossProfit / grossLoss;
  }

  /**
   * Annualised Sharpe ratio from trade PnLs.
   * Assumes ~365 * 24 hours of market data; scales by sqrt(tradesPerYear).
   * Returns 0 for empty or single-trade inputs.
   */
  static sharpeRatio(trades: TradeRecord[], riskFreeRate = 0): number {
    if (trades.length < 2) return 0;

    const pnls = trades.map((t) => t.pnl);
    const n = pnls.length;

    // Time between first and last trade to estimate trades/year
    const totalDuration = trades[n - 1].exitTs - trades[0].entryTs;
    if (totalDuration <= 0) return 0;

    const mean = pnls.reduce((s, v) => s + v, 0) / n;
    const variance =
      pnls.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);

    if (std === 0) return 0;

    const tradesPerYear = (n / totalDuration) * 365.25 * 24 * 3600 * 1000;
    const annualisedStd = std * Math.sqrt(tradesPerYear);
    const annualisedRfPerTrade = (riskFreeRate / 100) / tradesPerYear;

    return (mean - annualisedRfPerTrade) / annualisedStd;
  }

  /** Max drawdown as a fraction of startEquity (0..1). Returns 0 for empty. */
  static maxDrawdown(trades: TradeRecord[], startEquity: number): number {
    if (trades.length === 0 || startEquity <= 0) return 0;

    let peak = startEquity;
    let maxDd = 0;
    let equity = startEquity;

    for (const t of trades) {
      equity += t.pnl;
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    return maxDd;
  }

  /** Average R-multiple across trades. Returns 0 for empty. */
  static avgRMultiple(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;
    const sum = trades.reduce((s, t) => s + t.rMultiple, 0);
    return sum / trades.length;
  }

  /**
   * Expected value per trade: winRate × avgWin − lossRate × avgLoss.
   * Returns 0 for empty input.
   */
  static expectancy(trades: TradeRecord[]): number {
    if (trades.length === 0) return 0;

    let totalWin = 0;
    let totalLoss = 0;
    let wins = 0;
    let losses = 0;

    for (const t of trades) {
      if (t.pnl > 0) {
        totalWin += t.pnl;
        wins++;
      } else if (t.pnl < 0) {
        totalLoss += Math.abs(t.pnl);
        losses++;
      }
    }

    const n = trades.length;
    const winRate = wins / n;
    const lossRate = losses / n;
    const avgWin = wins > 0 ? totalWin / wins : 0;
    const avgLoss = losses > 0 ? totalLoss / losses : 0;

    return winRate * avgWin - lossRate * avgLoss;
  }

  /**
   * Wilson score confidence interval for the true win rate (95% CI).
   * Returns { lower, upper } or { lower: 0, upper: 0 } for empty input.
   */
  static wilsonCI(trades: TradeRecord[]): { lower: number; upper: number } {
    if (trades.length === 0) return { lower: 0, upper: 0 };

    const n = trades.length;
    let wins = 0;
    for (const t of trades) {
      if (t.pnl > 0) wins++;
    }
    const p = wins / n;
    const z = 1.96; // 95 % confidence

    const denominator = 1 + (z * z) / n;
    const centre = p + (z * z) / (2 * n);
    const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) / denominator;

    const adjusted = centre / denominator;

    return {
      lower: Math.max(0, adjusted - margin),
      upper: Math.min(1, adjusted + margin),
    };
  }
}
