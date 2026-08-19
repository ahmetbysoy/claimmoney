import type { Candle, ReplayConfig, ReplayResult, ReplaySnapshot, Regime, Signal, Position, RiskConfig } from './types';
import { MarketRuntime } from './market-runtime';
import { FeeAccounting } from './fee-accounting';
import { PaperExecution } from './paper-execution';
import { RegimeClassifier } from './regime-classifier';
import { crc32c } from './okx-integration';

export class JSONLReplay {
  loadFile(content: string): Candle[] {
    const lines = content.trim().split('\n').filter((l) => l.trim().length > 0);
    const candles: Candle[] = [];
    for (const line of lines) {
      try {
        const obj = JSON.parse(line) as Candle;
        candles.push(obj);
      } catch {
        throw new Error(`Invalid JSONL line: ${line.slice(0, 80)}`);
      }
    }
    return candles;
  }

  toFile(candles: Candle[]): string {
    return candles.map((c) => JSON.stringify(c)).join('\n');
  }

  replay(
    candles: Candle[],
    config: ReplayConfig,
    riskConfig?: RiskConfig
  ): ReplayResult {
    const runtime = new MarketRuntime();
    const classifier = new RegimeClassifier();
    const defaultRisk: RiskConfig = riskConfig ?? {
      equity: 10000,
      maxRiskPerTrade: 0.01,
      maxOpenPositions: 5,
      maxDailyLoss: 0.03,
      maxCorrelationExposure: 0.5,
      defaultStopLossATR: 1.5,
      defaultTP1R: 1,
      defaultTP2R: 2,
    };
    const executor = new PaperExecution(new FeeAccounting(), defaultRisk);

    const snapshots: ReplaySnapshot[] = [];
    const returns: number[] = [];
    let maxEquity = defaultRisk.equity;
    let maxDD = 0;
    let wins = 0;
    let totalTrades = 0;

    for (const candle of candles) {
      runtime.processCandle(candle);

      const state = runtime.getState();
      const regime = classifier.classify(runtime.getState().allCandles);

      // Update open positions
      for (const pos of executor.getOpenPositions()) {
        executor.updatePosition(pos, candle.c);
      }

      const equity = defaultRisk.equity + executor.getEquity();
      if (equity > maxEquity) maxEquity = equity;
      const dd = maxEquity > 0 ? (maxEquity - equity) / maxEquity : 0;
      if (dd > maxDD) maxDD = dd;

      const ret = state.previousPrice > 0 ? (candle.c - state.previousPrice) / state.previousPrice : 0;
      if (ret !== 0) returns.push(ret);

      const snapshot: ReplaySnapshot = {
        ts: candle.ts,
        equity,
        positions: executor.getOpenPositions().map((p) => ({ ...p })),
        signals: [],
        regime,
      };
      snapshots.push(snapshot);
    }

    // Count closed trades
    const closed = executor.getClosedPositions();
    totalTrades = closed.length;
    wins = closed.filter((p) => p.pnl > 0).length;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;

    // Sharpe ratio
    const avgRet = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdRet =
      returns.length > 1
        ? Math.sqrt(returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (returns.length - 1))
        : 0;
    const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    const finalEquity = snapshots.length > 0 ? snapshots[snapshots.length - 1].equity : defaultRisk.equity;
    const totalReturn = (finalEquity - defaultRisk.equity) / defaultRisk.equity;

    // Byte checksum for determinism verification
    const snapshotStr = JSON.stringify(snapshots);
    const byteChecksum = crc32c(snapshotStr);

    return {
      snapshots,
      finalEquity,
      totalReturn,
      maxDrawdown: maxDD,
      sharpeRatio: sharpe,
      totalTrades,
      winRate,
      byteChecksum,
    };
  }

  exportResult(result: ReplayResult): string {
    const output = {
      ...result,
      exportedAt: Date.now(),
    };
    return JSON.stringify(output, null, 2);
  }
}
