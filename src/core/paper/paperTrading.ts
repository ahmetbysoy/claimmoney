import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'
import type { PositionSize, TradePlan } from '../signal/tradePlan'

export type PositionDir = 'LONG' | 'SHORT'
export type PositionStatus = 'open' | 'closed'
export type ExitReason = 'stop' | 'tp1' | 'tp2' | 'manual'
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'expired'

export interface PaperOrder {
  id: string; planId: string; dir: PositionDir; qty: number; entry: number; stop: number; tp1: number; tp2: number
  submittedAt: number; expiresAt: number; status: OrderStatus; estimatedBookDepth: number; lastPrice: number
}
export interface PaperPosition {
  id: string; planId?: string; dir: PositionDir; qty: number; initialQty?: number; entry: number; stop: number; tp1: number; tp2: number
  slippageBps: number; openedAt: number; closedAt?: number; exit?: number; reason?: ExitReason; status: PositionStatus
  tp1Filled?: boolean; realizedPnl?: number; feesPaid?: number; initialRiskUSD?: number
}
export interface PerformanceMetrics {
  trades: number; wins: number; netR: number; netPnl: number; pf: number; sharpe: number; maxDD: number
  equity: number[]; avgHoldMs: number; feesPaid: number
}
export interface PaperTradingConfig {
  cooldownMs: number; maxPositions: number; maxClosedHistory: number; maxEquityLength: number
  feeRateBps: number; orderTtlMs: number; initialBalance: number; tp1Fraction: number
}

type PaperEvents = {
  'paper:order': PaperOrder
  'paper:open': PaperPosition
  'paper:close': { position: PaperPosition; exitPrice: number; reason: ExitReason; pnl: number; r: number }
  'paper:update': { positions: PaperPosition[]; orders: PaperOrder[]; performance: PerformanceMetrics }
}
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
const std = (values: number[]) => {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

export class PaperTradingEngine {
  private positions: PaperPosition[] = []
  private closedPositions: PaperPosition[] = []
  private orders: PaperOrder[] = []
  private performance: PerformanceMetrics
  private config: PaperTradingConfig
  private cooldownUntil = 0
  private sequence = 0
  private listeners = new Map<keyof PaperEvents, Set<(payload: never) => void>>()

  constructor(config?: Partial<PaperTradingConfig>, private readonly clock: Clock = systemClock) {
    this.config = { cooldownMs: 30_000, maxPositions: 3, maxClosedHistory: 500, maxEquityLength: 300,
      feeRateBps: 4, orderTtlMs: 30_000, initialBalance: 1000, tp1Fraction: 0.5, ...config }
    this.performance = this.initialPerformance()
  }
  private initialPerformance(): PerformanceMetrics {
    return { trades: 0, wins: 0, netR: 0, netPnl: 0, pf: 0, sharpe: 0, maxDD: 0,
      equity: [this.config?.initialBalance ?? 1000], avgHoldMs: 0, feesPaid: 0 }
  }

  on<K extends keyof PaperEvents>(event: K, fn: (data: PaperEvents[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(fn as (payload: never) => void); this.listeners.set(event, set)
    return () => set.delete(fn as (payload: never) => void)
  }
  private emit<K extends keyof PaperEvents>(event: K, data: PaperEvents[K]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(data as never)
  }
  private publish(): void {
    this.emit('paper:update', { positions: this.getOpenPositions(), orders: this.getOrders(), performance: this.getPerformance() })
  }

  submitPlan(planId: string, plan: TradePlan, positionSize: PositionSize | null, bookDepth: number, lastPrice: number): PaperOrder | null {
    const now = this.clock.now()
    if (!positionSize || plan.direction === 'NEUTRAL' || now < this.cooldownUntil || !plan.entry || !plan.stop || !plan.tp1 || !plan.tp2) return null
    if (this.orders.some(order => order.planId === planId && order.status === 'pending') || this.positions.some(position => position.planId === planId)) return null
    if (this.getOpenPositions().length + this.orders.filter(order => order.status === 'pending').length >= this.config.maxPositions) return null
    const order: PaperOrder = {
      id: `order_${now}_${++this.sequence}`, planId, dir: plan.direction, qty: positionSize.qty,
      entry: plan.entry, stop: plan.stop, tp1: plan.tp1, tp2: plan.tp2, submittedAt: now,
      expiresAt: now + this.config.orderTtlMs, status: 'pending', estimatedBookDepth: Math.max(0, bookDepth), lastPrice
    }
    this.orders.push(order); this.emit('paper:order', { ...order }); this.publish(); return { ...order }
  }

  private slippageBps(qty: number, price: number, bookDepth: number): number {
    return clamp((qty / Math.max(bookDepth, 1e-9)) * 10_000 * 0.5, 0, 25)
  }

  private fillOrder(order: PaperOrder, price: number): PaperPosition {
    const slipBps = this.slippageBps(order.qty, price, order.estimatedBookDepth)
    const fill = order.dir === 'LONG' ? order.entry * (1 + slipBps / 10_000) : order.entry * (1 - slipBps / 10_000)
    const entryFee = fill * order.qty * this.config.feeRateBps / 10_000
    const position: PaperPosition = {
      id: `pos_${this.clock.now()}_${++this.sequence}`, planId: order.planId, dir: order.dir, qty: order.qty,
      initialQty: order.qty, entry: fill, stop: order.stop, tp1: order.tp1, tp2: order.tp2, slippageBps: slipBps,
      openedAt: this.clock.now(), status: 'open', tp1Filled: false, realizedPnl: 0, feesPaid: entryFee,
      initialRiskUSD: Math.abs(fill - order.stop) * order.qty
    }
    order.status = 'filled'; this.positions.push(position); this.cooldownUntil = this.clock.now() + this.config.cooldownMs
    this.emit('paper:open', { ...position }); return position
  }

  /** Compatibility API: fills immediately at the supplied last price. New code should use submitPlan + update. */
  simulateFromPlan(plan: TradePlan, positionSize: PositionSize | null, bookDepth: number, lastPrice: number): PaperPosition | null {
    const order = this.submitPlan(`legacy_${plan.ts}`, plan, positionSize, bookDepth, lastPrice)
    if (!order) return null
    return this.fillOrder(this.orders.find(item => item.id === order.id)!, lastPrice)
  }

  update(price: number): void {
    if (!Number.isFinite(price) || price <= 0) return
    const now = this.clock.now()
    for (const order of this.orders.filter(item => item.status === 'pending')) {
      if (now >= order.expiresAt) { order.status = 'expired'; continue }
      order.lastPrice = price
      const reached = order.dir === 'LONG' ? price >= order.entry : price <= order.entry
      if (reached) this.fillOrder(order, price)
    }

    for (const position of this.positions.filter(item => item.status === 'open')) {
      if (position.dir === 'LONG') {
        if (price <= position.stop) this.close(position, Math.min(price, position.stop), 'stop')
        else if (price >= position.tp2) this.close(position, Math.max(position.tp2, price), 'tp2')
        else if (price >= position.tp1 && !position.tp1Filled) this.takePartial(position, position.tp1)
      } else {
        if (price >= position.stop) this.close(position, Math.max(price, position.stop), 'stop')
        else if (price <= position.tp2) this.close(position, Math.min(position.tp2, price), 'tp2')
        else if (price <= position.tp1 && !position.tp1Filled) this.takePartial(position, position.tp1)
      }
    }
    this.publish()
  }

  private signedPnl(position: PaperPosition, exitPrice: number, qty: number): number {
    return (position.dir === 'LONG' ? exitPrice - position.entry : position.entry - exitPrice) * qty
  }

  private takePartial(position: PaperPosition, exitPrice: number): void {
    const exitQty = Math.min(position.qty, (position.initialQty ?? position.qty) * this.config.tp1Fraction)
    const fee = exitPrice * exitQty * this.config.feeRateBps / 10_000
    position.realizedPnl = (position.realizedPnl ?? 0) + this.signedPnl(position, exitPrice, exitQty)
    position.feesPaid = (position.feesPaid ?? 0) + fee
    position.qty -= exitQty; position.tp1Filled = true; position.stop = position.entry
    if (position.qty <= 1e-12) this.close(position, exitPrice, 'tp1')
  }

  close(position: PaperPosition, exitPrice: number, reason: ExitReason): void {
    if (position.status === 'closed') return
    const exitFee = exitPrice * position.qty * this.config.feeRateBps / 10_000
    const finalLeg = this.signedPnl(position, exitPrice, position.qty)
    const pnl = (position.realizedPnl ?? 0) + finalLeg - (position.feesPaid ?? 0) - exitFee
    position.realizedPnl = pnl; position.feesPaid = (position.feesPaid ?? 0) + exitFee
    position.status = 'closed'; position.closedAt = this.clock.now(); position.exit = exitPrice; position.reason = reason; position.qty = 0
    const r = pnl / Math.max(position.initialRiskUSD ?? 0, 1e-9)
    this.closedPositions.unshift({ ...position })
    if (this.closedPositions.length > this.config.maxClosedHistory) this.closedPositions.splice(this.config.maxClosedHistory)
    this.positions = this.positions.filter(item => item.id !== position.id)
    this.updatePerformance(pnl, r, position)
    this.emit('paper:close', { position: { ...position }, exitPrice, reason, pnl, r })
  }

  private updatePerformance(pnl: number, r: number, position: PaperPosition): void {
    this.performance.trades += 1; if (pnl > 0) this.performance.wins += 1
    this.performance.netR += r; this.performance.netPnl += pnl; this.performance.feesPaid += position.feesPaid ?? 0
    const equity = this.performance.equity
    equity.push(equity.at(-1)! + pnl)
    if (equity.length > this.config.maxEquityLength) equity.splice(0, equity.length - this.config.maxEquityLength)
    let peak = equity[0] ?? this.config.initialBalance, maxDD = this.performance.maxDD
    for (const value of equity) { peak = Math.max(peak, value); maxDD = Math.max(maxDD, peak > 0 ? (peak - value) / peak * 100 : 0) }
    this.performance.maxDD = maxDD
    this.performance.avgHoldMs = mean(this.closedPositions.slice(0, 20).map(item => (item.closedAt ?? item.openedAt) - item.openedAt))
    const returns = this.closedPositions.map(item => (item.realizedPnl ?? 0) / Math.max(item.initialRiskUSD ?? 0, 1e-9))
    const wins = returns.filter(value => value > 0).reduce((a, b) => a + b, 0)
    const losses = Math.abs(returns.filter(value => value < 0).reduce((a, b) => a + b, 0))
    this.performance.pf = losses > 0 ? wins / losses : wins > 0 ? Infinity : 0
    const deviation = std(returns)
    this.performance.sharpe = returns.length > 5 && deviation > 1e-9 ? mean(returns) / deviation * Math.sqrt(returns.length) : 0
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.find(item => item.id === orderId && item.status === 'pending')
    if (!order) return false
    order.status = 'cancelled'; this.publish(); return true
  }
  getOrders(): PaperOrder[] { return this.orders.map(order => ({ ...order })) }
  getOpenPositions(): PaperPosition[] { return this.positions.filter(position => position.status === 'open').map(position => ({ ...position })) }
  getClosedPositions(): PaperPosition[] { return this.closedPositions.map(position => ({ ...position })) }
  getPerformance(): PerformanceMetrics { return { ...this.performance, equity: [...this.performance.equity] } }
  updateConfig(config: Partial<PaperTradingConfig>): void { this.config = { ...this.config, ...config } }
  reset(): void { this.positions = []; this.closedPositions = []; this.orders = []; this.performance = this.initialPerformance(); this.cooldownUntil = 0; this.sequence = 0 }
}
