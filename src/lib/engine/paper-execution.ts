import type { Signal, Position, PositionStatus, RiskConfig } from './types';
import { FeeAccounting } from './fee-accounting';
import { RiskPlanner } from './risk-planner';
import { generateId } from './helpers';

export class PaperExecution {
  private openPositions: Position[] = [];
  private closedPositions: Position[] = [];
  private feeAccounting: FeeAccounting;
  private riskPlanner: RiskPlanner;
  private riskConfig: RiskConfig;
  private equity: number;
  private slippageBps: number;

  constructor(feeAccounting: FeeAccounting, riskConfig: RiskConfig, slippageBps = 1) {
    this.feeAccounting = feeAccounting;
    this.riskConfig = riskConfig;
    this.riskPlanner = new RiskPlanner();
    this.equity = riskConfig.equity;
    this.slippageBps = slippageBps;
  }

  executeSignal(
    signal: Signal,
    state: { atr: number; currentPrice: number },
    riskConfig?: RiskConfig
  ): Position | null {
    const cfg = riskConfig ?? this.riskConfig;

    if (!this.riskPlanner.checkRisk(cfg, this.openPositions, signal)) return null;

    const price = state.currentPrice;
    const atrVal = state.atr;

    const sl = this.riskPlanner.calculateStopLoss(
      signal.side === 'long' ? price : price,
      atrVal,
      cfg.defaultStopLossATR
    );

    // For short, SL is above entry
    const stopLoss = signal.side === 'long'
      ? price - atrVal * cfg.defaultStopLossATR
      : price + atrVal * cfg.defaultStopLossATR;

    const { tp1, tp2 } = this.riskPlanner.calculateTakeProfits(
      signal.side === 'long' ? price : price,
      stopLoss,
      cfg.defaultTP1R,
      cfg.defaultTP2R
    );

    // Adjust TPs for short
    const actualTp1 = signal.side === 'long' ? tp1 : price - (tp1 - price);
    const actualTp2 = signal.side === 'long' ? tp2 : price - (tp2 - price);

    const size = this.riskPlanner.calculatePositionSize(cfg, price, stopLoss);
    if (size <= 0) return null;

    const entrySlip = this.feeAccounting.calculateSlippage(price, signal.side, this.slippageBps);
    const entryPrice = price + entrySlip;
    const fee = this.feeAccounting.calculateFee(size, entryPrice, true);

    const position: Position = {
      id: generateId('pos'),
      symbol: signal.symbol,
      side: signal.side,
      entryPrice,
      currentPrice: entryPrice,
      size,
      stopLoss,
      takeProfit1: actualTp1,
      takeProfit2: actualTp2,
      fee,
      slippage: Math.abs(entrySlip) * size,
      pnl: 0,
      rMultiple: 0,
      status: 'open',
      entryTs: signal.ts,
    };

    this.openPositions.push(position);
    return position;
  }

  updatePosition(position: Position, currentPrice: number): Position {
    const idx = this.openPositions.findIndex((p) => p.id === position.id);
    if (idx === -1) return position;

    const pos = this.openPositions[idx];
    pos.currentPrice = currentPrice;

    if (pos.side === 'long') {
      pos.pnl = (currentPrice - pos.entryPrice) * pos.size - pos.fee;
    } else {
      pos.pnl = (pos.entryPrice - currentPrice) * pos.size - pos.fee;
    }

    const riskAmt = Math.abs(pos.entryPrice - pos.stopLoss) * pos.size;
    pos.rMultiple = this.feeAccounting.calculateRMultiple(pos.pnl, riskAmt);

    // Check exit conditions
    let shouldClose = false;
    let newStatus: PositionStatus = 'closed';

    if (pos.side === 'long') {
      if (currentPrice <= pos.stopLoss) {
        shouldClose = true;
        newStatus = 'stopped_out';
      } else if (currentPrice >= pos.takeProfit1 && pos.status === 'open') {
        pos.status = 'tp1_hit';
        pos.stopLoss = pos.entryPrice;
      } else if (currentPrice >= pos.takeProfit2) {
        shouldClose = true;
        newStatus = 'tp2_hit';
      }
    } else {
      if (currentPrice >= pos.stopLoss) {
        shouldClose = true;
        newStatus = 'stopped_out';
      } else if (currentPrice <= pos.takeProfit1 && pos.status === 'open') {
        pos.status = 'tp1_hit';
        pos.stopLoss = pos.entryPrice;
      } else if (currentPrice <= pos.takeProfit2) {
        shouldClose = true;
        newStatus = 'tp2_hit';
      }
    }

    // Breakeven check after TP1
    const bePrice = this.feeAccounting.calculateBreakevenPrice(
      pos.entryPrice, pos.fee * 2, pos.size, pos.side
    );
    if (pos.status === 'tp1_hit') {
      if (pos.side === 'long' && currentPrice <= bePrice) {
        shouldClose = true;
        newStatus = 'breakeven';
      } else if (pos.side === 'short' && currentPrice >= bePrice) {
        shouldClose = true;
        newStatus = 'breakeven';
      }
    }

    if (shouldClose) {
      pos.status = newStatus;
      pos.exitTs = Date.now();
      pos.exitPrice = currentPrice;
      const exitFee = this.feeAccounting.calculateFee(pos.size, currentPrice, false);
      pos.fee += exitFee;
      if (pos.side === 'long') {
        pos.pnl = (currentPrice - pos.entryPrice) * pos.size - pos.fee;
      } else {
        pos.pnl = (pos.entryPrice - currentPrice) * pos.size - pos.fee;
      }
      pos.rMultiple = this.feeAccounting.calculateRMultiple(pos.pnl, riskAmt);
      this.openPositions.splice(idx, 1);
      this.closedPositions.push(pos);
      this.equity += pos.pnl;
    }

    return pos;
  }

  getOpenPositions(): Position[] {
    return [...this.openPositions];
  }

  getClosedPositions(): Position[] {
    return [...this.closedPositions];
  }

  getEquity(): number {
    const openPnL = this.openPositions.reduce((s, p) => s + p.pnl, 0);
    return this.equity + openPnL;
  }

  reset(): void {
    this.openPositions = [];
    this.closedPositions = [];
    this.equity = this.riskConfig.equity;
  }
}
