import type { InstrumentSpec } from '../domain/instrument'
import { roundToStep } from '../domain/instrument'
import type { PositionSize, TradePlan } from '../core/signal/tradePlan'

export interface PositionSizerConfig {
  balance: number; riskPct: number; maxLeverage: number; feeRateBps: number
  performanceRiskScaleFraction: number; maintenanceMarginRate: number
  priorWins: number; priorTrades: number; minRiskScale: number; maxEdgeFraction: number
}
export interface PerformanceInput { trades: number; wins: number }

export class PositionSizer {
  private config: PositionSizerConfig
  constructor(config: Partial<PositionSizerConfig> = {}) {
    this.config = { balance: 1000, riskPct: 1, maxLeverage: 10, feeRateBps: 4,
      performanceRiskScaleFraction: 0.25, maintenanceMarginRate: 0.004,
      priorWins: 8, priorTrades: 20, minRiskScale: 0.1, maxEdgeFraction: 0.25, ...config }
  }

  size(plan: TradePlan, instrument: InstrumentSpec, performance?: PerformanceInput): PositionSize | null {
    if (plan.direction === 'NEUTRAL' || !plan.entry || !plan.stop || !plan.rr) return null
    const riskBudget = this.config.balance * this.config.riskPct / 100
    const riskPerUnit = Math.abs(plan.entry - plan.stop) * instrument.contractMultiplier
    if (riskPerUnit <= 0) return null
    // Conservative heuristic scaling with a fixed prior; this is not a learned or statistically validated Kelly estimate.
    const winRate = ((performance?.wins ?? 0) + this.config.priorWins) /
      ((performance?.trades ?? 0) + this.config.priorTrades)
    const edgeFraction = Math.max(0, Math.min(this.config.maxEdgeFraction,
      winRate - (1 - winRate) / Math.max(0.1, plan.rr)))
    const performanceRiskScale = Math.max(this.config.minRiskScale,
      Math.min(1, edgeFraction / Math.max(this.config.maxEdgeFraction, 1e-9) * this.config.performanceRiskScaleFraction))
    let qty = roundToStep(riskBudget / riskPerUnit * performanceRiskScale, instrument.lotSize, 'down')
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
    // Simplified isolated-margin screening estimate. Real exchange liquidation depends on
    // maintenance tiers, fee buffers, margin mode and other positions.
    const liqPriceEstimate = plan.direction === 'LONG'
      ? plan.entry * (1 - 1 / leverage + this.config.maintenanceMarginRate)
      : plan.entry * (1 + 1 / leverage - this.config.maintenanceMarginRate)
    const safe = plan.direction === 'LONG' ? plan.stop > liqPriceEstimate * 1.002 : plan.stop < liqPriceEstimate * 0.998
    if (!safe) return null
    return { riskPct: this.config.riskPct, qty, notional, contractMultiplier: instrument.contractMultiplier,
      margin, leverage, fee, breakEven, liqPriceEstimate, maxRiskUSD: riskBudget, rr: plan.rr }
  }
  updateConfig(config: Partial<PositionSizerConfig>): void { this.config = { ...this.config, ...config } }
}
