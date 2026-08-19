import type { TradePlan } from '../risk/tradePlanner';
import type { SizingResult } from '../risk/positionSizer';

export type PaperOrderStatus = 'pending' | 'partial_fill' | 'filled' | 'partial_exit' | 'closed' | 'stopped_out' | 'tp1_hit' | 'tp2_hit';

export interface PaperOrder {
  id: string;
  side: 'BUY' | 'SELL';
  plan: TradePlan;
  sizing: SizingResult;
  status: PaperOrderStatus;
  filledQty: number;
  remainingQty: number;
  avgFillPrice: number;
  totalFees: number;
  currentPrice: number;
  pnl: number;
  rMultiple: number;
  entryTs: number;
  exitTs?: number;
  tp1ExitQty: number;
  tp1ExitPrice: number;
  tp2ExitQty: number;
  tp2ExitPrice: number;
  slExitPrice?: number;
}

export class PaperBroker {
  private orders: PaperOrder[] = [];
  private equity: number;
  private closedPnl = 0;
  private makerFee: number;
  private takerFee: number;
  private tp1CloseRatio = 0.5; // Close 50% at TP1

  constructor(equity: number, makerFee = 0.0002, takerFee = 0.0005) {
    this.equity = equity;
    this.makerFee = makerFee;
    this.takerFee = takerFee;
  }

  submitOrder(plan: TradePlan, sizing: SizingResult, ts: number): PaperOrder {
    const order: PaperOrder = {
      id: 'po_' + Date.now().toString(36),
      side: plan.side,
      plan: { ...plan }, // immutable copy
      sizing,
      status: 'pending',
      filledQty: 0,
      remainingQty: sizing.qty,
      avgFillPrice: 0,
      totalFees: 0,
      currentPrice: 0,
      pnl: 0,
      rMultiple: 0,
      entryTs: ts,
      tp1ExitQty: 0,
      tp1ExitPrice: 0,
      tp2ExitQty: 0,
      tp2ExitPrice: 0,
    };
    this.orders.push(order);
    return order;
  }

  updateOrder(orderId: string, price: number, ts: number): PaperOrder | undefined {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || order.status === 'closed' || order.status === 'stopped_out' || order.status === 'tp2_hit') return;

    // Pending → Fill
    if (order.status === 'pending') {
      order.status = 'filled';
      order.filledQty = order.sizing.qty;
      order.remainingQty = order.sizing.qty;
      order.avgFillPrice = order.plan.entryPrice;
      const entryFee = order.filledQty * order.avgFillPrice * this.takerFee;
      order.totalFees = entryFee;
    }

    order.currentPrice = price;
    const riskPerUnit = Math.abs(order.plan.entryPrice - order.plan.stopLoss);

    // Calculate unrealized PnL on remaining qty
    if (order.side === 'BUY') {
      const unrealPnl = (price - order.avgFillPrice) * order.remainingQty;
      const tp1Pnl = (order.tp1ExitPrice - order.avgFillPrice) * order.tp1ExitQty;
      order.pnl = tp1Pnl + unrealPnl - order.totalFees;
    } else {
      const unrealPnl = (order.avgFillPrice - price) * order.remainingQty;
      const tp1Pnl = (order.avgFillPrice - order.tp1ExitPrice) * order.tp1ExitQty;
      order.pnl = tp1Pnl + unrealPnl - order.totalFees;
    }
    const riskAmount = riskPerUnit * order.filledQty;
    order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;

    // Check exits
    if (order.side === 'BUY') {
      if (price <= order.plan.stopLoss) {
        // Stop loss — close remaining
        const exitQty = order.remainingQty;
        const exitNotional = exitQty * order.plan.stopLoss;
        order.totalFees += exitNotional * this.takerFee;
        order.slExitPrice = order.plan.stopLoss;
        const slPnl = (order.plan.stopLoss - order.avgFillPrice) * exitQty;
        const tp1Pnl = (order.tp1ExitPrice - order.avgFillPrice) * order.tp1ExitQty;
        order.pnl = tp1Pnl + slPnl - order.totalFees;
        order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;
        order.remainingQty = 0;
        order.status = 'stopped_out';
        order.exitTs = ts;
        this.closedPnl += order.pnl;
      } else if (price >= order.plan.takeProfit1 && order.status === 'filled') {
        // TP1 — partial exit 50%
        const exitQty = order.filledQty * this.tp1CloseRatio;
        order.tp1ExitQty = exitQty;
        order.tp1ExitPrice = price;
        order.remainingQty -= exitQty;
        const tp1Notional = exitQty * price;
        order.totalFees += tp1Notional * this.takerFee;
        // Move stop to breakeven
        order.plan.stopLoss = order.plan.entryPrice;
        order.status = 'tp1_hit';
      } else if (price >= order.plan.takeProfit2 && (order.status === 'filled' || order.status === 'tp1_hit')) {
        // TP2 — close remaining
        const exitQty = order.remainingQty;
        order.tp2ExitQty = exitQty;
        order.tp2ExitPrice = price;
        const tp2Notional = exitQty * price;
        order.totalFees += tp2Notional * this.takerFee;
        const tp1Pnl = (order.tp1ExitPrice - order.avgFillPrice) * order.tp1ExitQty;
        const tp2Pnl = (price - order.avgFillPrice) * exitQty;
        order.pnl = tp1Pnl + tp2Pnl - order.totalFees;
        order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;
        order.remainingQty = 0;
        order.status = 'tp2_hit';
        order.exitTs = ts;
        this.closedPnl += order.pnl;
      }
    } else {
      // SELL side
      if (price >= order.plan.stopLoss) {
        const exitQty = order.remainingQty;
        const exitNotional = exitQty * order.plan.stopLoss;
        order.totalFees += exitNotional * this.takerFee;
        order.slExitPrice = order.plan.stopLoss;
        const slPnl = (order.avgFillPrice - order.plan.stopLoss) * exitQty;
        const tp1Pnl = (order.avgFillPrice - order.tp1ExitPrice) * order.tp1ExitQty;
        order.pnl = tp1Pnl + slPnl - order.totalFees;
        order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;
        order.remainingQty = 0;
        order.status = 'stopped_out';
        order.exitTs = ts;
        this.closedPnl += order.pnl;
      } else if (price <= order.plan.takeProfit1 && order.status === 'filled') {
        const exitQty = order.filledQty * this.tp1CloseRatio;
        order.tp1ExitQty = exitQty;
        order.tp1ExitPrice = price;
        order.remainingQty -= exitQty;
        const tp1Notional = exitQty * price;
        order.totalFees += tp1Notional * this.takerFee;
        order.plan.stopLoss = order.plan.entryPrice;
        order.status = 'tp1_hit';
      } else if (price <= order.plan.takeProfit2 && (order.status === 'filled' || order.status === 'tp1_hit')) {
        const exitQty = order.remainingQty;
        order.tp2ExitQty = exitQty;
        order.tp2ExitPrice = price;
        const tp2Notional = exitQty * price;
        order.totalFees += tp2Notional * this.takerFee;
        const tp1Pnl = (order.avgFillPrice - order.tp1ExitPrice) * order.tp1ExitQty;
        const tp2Pnl = (order.avgFillPrice - price) * exitQty;
        order.pnl = tp1Pnl + tp2Pnl - order.totalFees;
        order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;
        order.remainingQty = 0;
        order.status = 'tp2_hit';
        order.exitTs = ts;
        this.closedPnl += order.pnl;
      }
    }
    return order;
  }

  getOpenOrders(): PaperOrder[] {
    return this.orders.filter(o => o.status === 'filled' || o.status === 'pending' || o.status === 'tp1_hit');
  }
  getClosedOrders(): PaperOrder[] {
    return this.orders.filter(o => ['closed', 'stopped_out', 'tp2_hit'].includes(o.status));
  }
  getEquity(): number {
    const openPnL = this.getOpenOrders().reduce((s, o) => s + o.pnl, 0);
    return this.equity + this.closedPnl + openPnL;
  }
  reset(): void { this.orders = []; this.closedPnl = 0; }
}