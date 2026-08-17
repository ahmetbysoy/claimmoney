import type { InstrumentSpec } from '../domain/instrument'
import { roundToStep } from '../domain/instrument'
import type { PositionSize, TradePlan } from '../core/signal/tradePlan'

export interface PositionSizerConfig { balance: number; riskPct: number; maxLeverage: number; feeRateBps: number; kellyFraction: number; maintenanceMarginRate: number }
export interface PerformanceInput { trades: number; wins: number }

export class PositionSizer {
  constructor(private config: PositionSizerConfig = { balance: 1000, riskPct: 1, maxLeverage: 10, feeRateBps: 4, kellyFraction: 0.25, maintenanceMarginRate: 0.004 }) {}

  size(plan: TradePlan, instrument: InstrumentSpec, performance?: PerformanceInput): PositionSize | null {
    if (plan.direction === 'NEUTRAL' || !plan.entry || !plan.stop || !plan.rr) return null
    const riskBudget = this.config.balance * this.config.riskPct / 100
    const riskPerUnit = Math.abs(plan.entry - plan.stop) * instrument.contractMultiplier
    if (riskPerUnit <= 0) return null
    const priorWins = 8, priorTrades = 20
    const winRate = ((performance?.wins ?? 0) + priorWins) / ((performance?.trades ?? 0) + priorTrades)
    const fullKelly = Math.max(0, Math.min(0.25, winRate - (1 - winRate) / Math.max(0.1, plan.rr)))
    const kellyScale = Math.max(0.1, Math.min(1, fullKelly / 0.25 * this.config.kellyFraction))
    let qty = roundToStep(riskBudget / riskPerUnit * kellyScale, instrument.lotSize, 'down')
    if (qty <= 0) return null
    let notional = qty * plan.entry * instrument.contractMultiplier
    const leverageCap = Math.min(this.config.maxLeverage, instrument.maxLeverage)
    if (notional > this.config.balance * leverageCap) {
      qty = roundToStep(this.config.balance * leverageCap / (plan.entry * instrument.contractMultiplier), instrument.lotSize, 'down')
      notional = qty * plan.entry * instrument.contractMultiplier
    }
    const leverage = Math.max(1, Math.min(leverageCap, notional / this.config.balance))
    const margin = notional / leverage
    const fee = notional * this.config.feeRateBps / 10_000 * 2
    const breakEven = qty > 0 ? fee / (qty * instrument.contractMultiplier) : 0
    const liqPrice = plan.direction === 'LONG'
      ? plan.entry * (1 - 1 / leverage + this.config.maintenanceMarginRate)
      : plan.entry * (1 + 1 / leverage - this.config.maintenanceMarginRate)
    // Reject a stop that is beyond/too close to liquidation.
    const safe = plan.direction === 'LONG' ? plan.stop > liqPrice * 1.002 : plan.stop < liqPrice * 0.998
    if (!safe) return null
    return { riskPct: this.config.riskPct, qty, notional, margin, leverage, fee, breakEven, liqPrice, maxRiskUSD: riskBudget, rr: plan.rr }
  }
  updateConfig(config: Partial<PositionSizerConfig>): void { this.config = { ...this.config, ...config } }
}
