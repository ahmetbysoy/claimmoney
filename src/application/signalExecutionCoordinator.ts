import type { InstrumentSpec } from '../domain/instrument'
import type { Signal } from '../types'
import type { PaperTradingEngine } from '../core/paper/paperTrading'
import type { PositionSize, TradePlan, WallEntry } from '../core/signal/tradePlan'
import type { PositionSizer } from '../risk/positionSizer'
import type { TradePlanner } from '../risk/tradePlanner'

export interface SignalExecutionInput {
  signal: Signal
  spread: number
  volatilityBps: number
  walls: { bid: WallEntry[]; ask: WallEntry[] }
  instrument: InstrumentSpec
  balance: number
  riskPct: number
  paperTradingEnabled: boolean
  lastPrice: number
}
export interface SignalExecutionResult { plan: TradePlan; positionSize: PositionSize | null; submitted: boolean }

/** Owns approved-signal planning, sizing and at-most-once paper submission. */
export class SignalExecutionCoordinator {
  private submittedSignalIds = new Set<string>()
  private submissionOrder: string[] = []

  constructor(
    private readonly planner: TradePlanner,
    private readonly sizer: PositionSizer,
    private readonly paper: PaperTradingEngine
  ) {}

  process(input: SignalExecutionInput): SignalExecutionResult {
    this.sizer.updateConfig({ balance: input.balance, riskPct: input.riskPct })
    const plan = this.planner.create(input.signal, {
      spread: input.spread, volatilityBps: input.volatilityBps, walls: input.walls, instrument: input.instrument
    })
    const performance = this.paper.getPerformance()
    const positionSize = this.sizer.size(plan, input.instrument, { trades: performance.trades, wins: performance.wins })
    let submitted = false
    if (input.paperTradingEnabled && plan.direction !== 'NEUTRAL' && positionSize && !this.submittedSignalIds.has(input.signal.id)) {
      submitted = this.paper.submitPlan(input.signal.id, plan, positionSize, input.lastPrice) !== null
      if (submitted) {
        this.submittedSignalIds.add(input.signal.id); this.submissionOrder.push(input.signal.id)
        if (this.submissionOrder.length > 500) this.submittedSignalIds.delete(this.submissionOrder.shift()!)
      }
    }
    return { plan, positionSize, submitted }
  }

  reset(): void { this.submittedSignalIds.clear(); this.submissionOrder = [] }
}
