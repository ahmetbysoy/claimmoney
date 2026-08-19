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
  avgFillPrice: number;
  totalFees: number;
  currentPrice: number;
  pnl: number;
  rMultiple: number;
  entryTs: number;
  exitTs?: number;
}

export class PaperBroker {
  private orders: PaperOrder[] = [];
  private equity: number;
  private makerFee: number;
  private takerFee: number;

  constructor(equity: number, makerFee = 0.0002, takerFee = 0.0005) {
    this.equity = equity;
    this.makerFee = makerFee;
    this.takerFee = takerFee;
  }

  submitOrder(plan: TradePlan, sizing: SizingResult, ts: number): PaperOrder {
    const fee = sizing.notional * this.takerFee;
    const order: PaperOrder = {
      id: 'po_' + Date.now().toString(36),
      side: plan.side,
      plan,
      sizing,
      status: 'pending',
      filledQty: 0,
      avgFillPrice: 0,
      totalFees: fee,
      currentPrice: 0,
      pnl: 0,
      rMultiple: 0,
      entryTs: ts,
    };
    this.orders.push(order);
    return order;
  }

  updateOrder(orderId: string, price: number, ts: number): PaperOrder | undefined {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || order.status === 'closed' || order.status === 'stopped_out' || order.status === 'tp2_hit') return;
    if (order.status === 'pending') {
      order.status = 'filled';
      order.filledQty = order.sizing.qty;
      order.avgFillPrice = order.plan.entryPrice;
    }
    order.currentPrice = price;
    const riskPerUnit = Math.abs(order.plan.entryPrice - order.plan.stopLoss);
    if (order.side === 'BUY') {
      order.pnl = (price - order.avgFillPrice) * order.filledQty - order.totalFees;
    } else {
      order.pnl = (order.avgFillPrice - price) * order.filledQty - order.totalFees;
    }
    const riskAmount = riskPerUnit * order.filledQty;
    order.rMultiple = riskAmount > 0 ? order.pnl / riskAmount : 0;
    // Check exits
    if (order.side === 'BUY') {
      if (price <= order.plan.stopLoss) {
        order.status = 'stopped_out';
        order.exitTs = ts;
        const exitFee = order.sizing.notional * this.takerFee;
        order.totalFees += exitFee;
        order.pnl = (order.plan.stopLoss - order.avgFillPrice) * order.filledQty - order.totalFees;
      } else if (price >= order.plan.takeProfit1 && order.status === 'filled') {
        order.status = 'tp1_hit';
        order.plan.stopLoss = order.plan.entryPrice;
      } else if (price >= order.plan.takeProfit2) {
        order.status = 'tp2_hit';
        order.exitTs = ts;
        const exitFee = order.sizing.notional * this.takerFee;
        order.totalFees += exitFee;
        order.pnl = (price - order.avgFillPrice) * order.filledQty - order.totalFees;
      }
    } else {
      if (price >= order.plan.stopLoss) {
        order.status = 'stopped_out';
        order.exitTs = ts;
        const exitFee = order.sizing.notional * this.takerFee;
        order.totalFees += exitFee;
        order.pnl = (order.avgFillPrice - order.plan.stopLoss) * order.filledQty - order.totalFees;
      } else if (price <= order.plan.takeProfit1 && order.status === 'filled') {
        order.status = 'tp1_hit';
        order.plan.stopLoss = order.plan.entryPrice;
      } else if (price <= order.plan.takeProfit2) {
        order.status = 'tp2_hit';
        order.exitTs = ts;
        const exitFee = order.sizing.notional * this.takerFee;
        order.totalFees += exitFee;
        order.pnl = (order.avgFillPrice - price) * order.filledQty - order.totalFees;
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
    return this.equity + openPnL;
  }
  reset(): void { this.orders = []; }
}