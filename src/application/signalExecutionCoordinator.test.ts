import { describe, expect, it } from 'vitest'
import { ManualClock } from './clock'
import { SignalExecutionCoordinator } from './signalExecutionCoordinator'
import { PaperTradingEngine } from '../core/paper/paperTrading'
import { DEFAULT_INSTRUMENT } from '../domain/instrument'
import { PositionSizer } from '../risk/positionSizer'
import { TradePlanner } from '../risk/tradePlanner'
import type { Signal } from '../types'

const signal: Signal = {
  id: 'approved-1', symbol: 'BTCUSDT', side: 'BUY', price: 100, confidence: 40, score: 1.2,
  breakdown: { cvd: 1, obi: .2, vel: .3, w1: .5, w2: .3, w3: .2 }, ts: 1_000
}

describe('SignalExecutionCoordinator', () => {
  it('owns planning, sizing and at-most-once paper submission for an approved signal', () => {
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, new ManualClock(1_000))
    const coordinator = new SignalExecutionCoordinator(
      new TradePlanner({ minRR: 1, feeRateBps: 0, slippageBps: 0 }),
      new PositionSizer({ balance: 10_000, riskPct: 1, feeRateBps: 0, minRiskScale: 1,
        performanceRiskScaleFraction: 1 }),
      paper
    )
    const input = { signal, spread: .01, volatilityBps: 10, walls: { bid: [], ask: [] },
      instrument: { ...DEFAULT_INSTRUMENT, tickSize: .01, lotSize: .001 }, balance: 10_000, riskPct: 1,
      paperTradingEnabled: true, lastPrice: 99 }
    const first = coordinator.process(input)
    const second = coordinator.process(input)
    expect(first.plan.direction).toBe('LONG')
    expect(first.positionSize).not.toBeNull()
    expect(first.submitted).toBe(true)
    expect(second.submitted).toBe(false)
    expect(paper.getOrders()).toHaveLength(1)
  })
})
