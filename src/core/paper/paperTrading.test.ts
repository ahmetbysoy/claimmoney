import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { PaperTradingEngine } from './paperTrading'
import type { PositionSize, TradePlan } from '../signal/tradePlan'

const plan: TradePlan = { direction: 'LONG', confidence: 80, entry: 100, stop: 99, tp1: 102, tp2: 104, rr: 2, ts: 1000 }
const size: PositionSize = { riskPct: 1, qty: 10, notional: 1000, margin: 100, leverage: 10, fee: 0, breakEven: 0, liqPrice: 90, maxRiskUSD: 10, rr: 2 }

describe('PaperTradingEngine accounting', () => {
  it('uses dollar risk including quantity when computing R', () => {
    const clock = new ManualClock(1000)
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, clock)
    paper.submitPlan('signal-1', plan, size, 1_000_000_000_000, 99)
    paper.update(100)
    expect(paper.getOpenPositions()).toHaveLength(1)
    clock.advance(1000); paper.update(99)
    expect(paper.getPerformance().netR).toBeCloseTo(-1, 5)
    expect(paper.getPerformance().netPnl).toBeCloseTo(-10, 5)
  })

  it('deduplicates one plan and supports TP1 partial then TP2 close', () => {
    const clock = new ManualClock(1000)
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0, tp1Fraction: .5 }, clock)
    expect(paper.submitPlan('signal-1', plan, size, 1_000_000_000_000, 99)).not.toBeNull()
    expect(paper.submitPlan('signal-1', plan, size, 1_000_000_000_000, 99)).toBeNull()
    paper.update(100); paper.update(102)
    const open = paper.getOpenPositions()[0]
    expect(open.tp1Filled).toBe(true)
    expect(open.qty).toBe(5)
    paper.update(104)
    expect(paper.getClosedPositions()).toHaveLength(1)
    expect(paper.getPerformance().netPnl).toBeCloseTo(30, 6)
  })
})
