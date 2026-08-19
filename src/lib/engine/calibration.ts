import type { Candle, RiskConfig, CalibrationResult } from './types';
import { MarketRuntime } from './market-runtime';
import { PaperExecution } from './paper-execution';
import { FeeAccounting } from './fee-accounting';
import { RegimeClassifier } from './regime-classifier';
import { average, standardDeviation } from './helpers';

export class Calibrator {
  calibrate(
    _detector: string,
    paramRanges: Record<string, [number, number]>,
    data: Candle[],
    riskConfig: RiskConfig,
    steps = 5
  ): CalibrationResult[] {
    const results: CalibrationResult[] = [];
    const params = Object.keys(paramRanges);
    if (params.length === 0) return results;

    // Single param grid search
    const param = params[0];
    const [min, max] = paramRanges[param];
    const step = (max - min) / (steps - 1 || 1);

    for (let i = 0; i < steps; i++) {
      const val = min + step * i;
      const result = this.runBacktest(data, riskConfig, { [param]: val });
      result.paramSet = { [param]: val };
      result.detector = _detector;
      results.push(result);
    }

    return results;
  }

  getBestResult(results: CalibrationResult[]): CalibrationResult {
    if (results.length === 0) {
      return {
        detector: '',
        paramSet: {},
        sharpeRatio: 0,
        maxDrawdown: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
      };
    }
    return results.reduce((best, r) => (r.sharpeRatio > best.sharpeRatio ? r : best), results[0]);
  }

  exportResults(results: CalibrationResult[]): string {
    return JSON.stringify(results, null, 2);
  }

  private runBacktest(
    candles: Candle[],
    riskConfig: RiskConfig,
    _params: Record<string, number>
  ): CalibrationResult {
    const runtime = new MarketRuntime();
    const fee = new FeeAccounting();
    const executor = new PaperExecution(fee, riskConfig);
    const classifier = new RegimeClassifier();
    const returns: number[] = [];
    let maxEquity = riskConfig.equity;
    let maxDD = 0;

    for (const candle of candles) {
      runtime.processCandle(candle);

      for (const pos of executor.getOpenPositions()) {
        executor.updatePosition(pos, candle.c);
      }

      const equity = executor.getEquity();
      if (equity > maxEquity) maxEquity = equity;
      const dd = maxEquity > 0 ? (maxEquity - equity) / maxEquity : 0;
      if (dd > maxDD) maxDD = dd;

      const state = runtime.getState();
      if (state.previousPrice > 0) {
        returns.push((candle.c - state.previousPrice) / state.previousPrice);
      }
    }

    const closed = executor.getClosedPositions();
    const wins = closed.filter((p) => p.pnl > 0);
    const losses = closed.filter((p) => p.pnl <= 0);
    const winRate = closed.length > 0 ? wins.length / closed.length : 0;
    const grossWin = wins.reduce((s, p) => s + p.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, p) => s + p.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

    const avgRet = returns.length > 0 ? average(returns) : 0;
    const stdRet = returns.length > 1 ? standardDeviation(returns) : 0;
    const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    return {
      detector: '',
      paramSet: _params,
      sharpeRatio: sharpe,
      maxDrawdown: maxDD,
      winRate,
      profitFactor,
      totalTrades: closed.length,
    };
  }
}
